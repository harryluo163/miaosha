var express = require('express');
var router = express.Router();
var redis = require('redis');
var bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
var kafka = require('kafka-node');
var Producer = kafka.Producer;
var kafkaClient = kafka.Client;
var client = new kafkaClient('47.105.36.188:2181');
var producer = new Producer(client, {
    requireAcks: 1
});
var count = 0;
// var client= redis.createClient(6379,"47.105.36.188",{password:"test123"});
var client= redis.createClient(6379,"10.58.8.81");
router.post('/seckill', function (req, res) {
    count++
    client.multi().get('counter').decr("counter").execAsync().then(function(reply) {
        if (reply[1] >= 0) {
            var payload = [
                {
                    topic: 'CAR_NUMBER',
                    messages: '购买成功，还剩下'+parseInt(reply[1])+'个',
                    partition: 0
                }
            ];
            producer.send(payload, function (err, data) {
                // console.log(data);
            });
            console.log('购买成功，还剩下'+parseInt(reply[1])+'个')
            res.json({messages:'购买成功，还剩下'+parseInt(reply[1])+'个'})
        } else {
            client.set("counter","0")
            console.log('抢完了'+parseInt(reply[1])+'个')
            res.json({messages:'抢完了'})

        }
    })
});
client.on('error', function (er) {
    console.trace('Here I am');
    console.error(er.stack);
    client.end(true);
});
router.get('/getCount', function (req, res) {
    client.multi().get('counter').execAsync().then(function(reply) {
        res.json({num:parseInt(reply[0])})

    })

})
module.exports = router;