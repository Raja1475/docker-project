const redis = require('redis');
const request = require('request');
const bodyParser = require('body-parser');
const express = require('express');
const pino = require('pino');
const expPino = require('express-pino-logger');
const promClient = require('prom-client');
const Registry = promClient.Registry;
const register = new Registry();
const counter = new promClient.Counter({
    name: 'items_added',
    help: 'running count of items added to cart',
    registers: [register]
});

const redisHost = process.env.REDIS_HOST || 'redis';
const catalogueHost = process.env.CATALOGUE_HOST || 'catalogue';
const cataloguePort = process.env.CATALOGUE_PORT || '8080';

const logger = pino({
    level: 'info',
    prettyPrint: false,
    useLevelLabels: true
});
const expLogger = expPino({
    logger: logger
});

const app = express();

app.use(expLogger);

app.use((req, res, next) => {
    res.set('Timing-Allow-Origin', '*');
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/health', (req, res) => {
    var stat = {
        app: 'OK',
        redis: redisConnected
    };
    res.json(stat);
});

app.get('/metrics', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send(register.metrics());
});

app.get('/cart/:id', async (req, res) => {
    try {
        const cart = await getCartFromRedis(req.params.id);
        if (!cart) {
            res.status(404).send('Cart not found');
            return;
        }

        // Fetch product information for each item from the catalog service
        const fetchProductPromises = cart.items.map(item => getProductFromCatalog(item.sku));
        const products = await Promise.all(fetchProductPromises);

        // Merge product information with cart items
        cart.items.forEach((item, index) => {
            item.productInfo = products[index];
        });

        res.json(cart);
    } catch (error) {
        logger.error(error);
        res.status(500).send(error.message);
    }
});

app.delete('/cart/:id', (req, res) => {
    deleteCart(req.params.id)
        .then(() => res.send('OK'))
        .catch(error => {
            logger.error(error);
            res.status(500).send(error.message);
        });
});

// ... (other routes)

function getCartFromRedis(id) {
    return new Promise((resolve, reject) => {
        redisClient.get(id, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data ? JSON.parse(data) : null);
            }
        });
    });
}

function getProductFromCatalog(sku) {
    return new Promise((resolve, reject) => {
        const catalogServiceUrl = `http://${catalogueHost}:${cataloguePort}/product/${sku}`;
        request(catalogServiceUrl, (err, response, body) => {
            if (err) {
                reject(err);
            } else if (response.statusCode !== 200) {
                resolve(null);
            } else {
                resolve(JSON.parse(body));
            }
        });
    });
}

function deleteCart(id) {
    return new Promise((resolve, reject) => {
        redisClient.del(id, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

const redisClient = redis.createClient({
    host: redisHost
});

let redisConnected = false;

redisClient.on('error', (e) => {
    logger.error('Redis ERROR', e);
});

redisClient.on('ready', (r) => {
    logger.info('Redis READY', r);
    redisConnected = true;
});

const port = process.env.CART_SERVER_PORT || '8080';

app.listen(port, () => {
    logger.info('Started on port', port);
});
