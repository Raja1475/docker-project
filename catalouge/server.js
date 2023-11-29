const { MongoClient } = require('mongodb');
const bodyParser = require('body-parser');
const express = require('express');
const pino = require('pino');
const expPino = require('express-pino-logger');

const logger = pino({
    level: 'info',
    prettyPrint: false,
    useLevelLabels: true
});

const expLogger = expPino({
    logger: logger
});

// MongoDB
let db;
let collection;
let mongoConnected = false;

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
    const stat = {
        app: 'OK-2',
        mongo: mongoConnected
    };
    res.json(stat);
});

// all products
app.get('/products', (req, res) => {
    // ... (existing route)
});

// product by SKU
app.get('/product/:sku', (req, res) => {
    // ... (existing route)
});

// products in a category
app.get('/products/:cat', (req, res) => {
    // ... (existing route)
});

// all categories
app.get('/categories', (req, res) => {
    // ... (existing route)
});

// search name and description
app.get('/search/:text', (req, res) => {
    // ... (existing route)
});

function mongoConnect() {
    return new Promise((resolve, reject) => {
        const mongoURL = process.env.MONGO_URL || 'mongodb://mongodb:27017/catalogue';

        MongoClient.connect(mongoURL, (error, client) => {
            if (error) {
                reject(error);
            } else {
                db = client.db('catalogue');
                collection = db.collection('products');
                resolve('connected');
            }
        });
    });
}

// MongoDB connection retry loop
function mongoLoop() {
    mongoConnect().then(() => {
        mongoConnected = true;
        logger.info('MongoDB connected');
    }).catch((error) => {
        logger.error('ERROR', error);
        setTimeout(mongoLoop, 2000);
    });
}

mongoLoop();

// fire it up!
const port = process.env.CATALOGUE_SERVER_PORT || '8080';
app.listen(port, () => {
    logger.info('Started on port', port);
});
