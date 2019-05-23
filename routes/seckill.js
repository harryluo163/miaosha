var express = require('express');
var router = express.Router();
var redis = require('redis');
var kafka = require('kafka-node');
var Producer = kafka.Producer;
var KeyedMessage = kafka.KeyedMessage;
var kafkaClient = kafka.Client;
var client = new kafkaClient('47.105.36.188:2181');
var producer = new Producer(client, {
    requireAcks: 1
});
var count = 0;
var client=null;
router.post('/seckill', function (req, res) {
    console.log('count=' + count++);
    var fn = function (optionalClient) {
        if (optionalClient == 'undefined' || optionalClient == null) {
            var client = redis.createClient(6379,"47.105.36.188",{password:"test123"});
        }else{
            var client = optionalClient;
        }
        client.on('error', function (er) {
            console.trace('Here I am');
            console.error(er.stack);
            client.end(true);
        });
        client.watch("counter");
        client.get("counter", function (err, reply) {
            if (parseInt(reply) > 0) {
                var multi = client.multi();
                multi.decr("counter");
                multi.exec(function (err, replies) {
                    if (replies == null) {
                        console.log('should have conflict')
                        fn(client);
                    } else {

                        var payload = [
                            {
                                topic: 'CAR_NUMBER',
                                messages: '购买成功，还剩下'+parseInt(reply-1)+'个',
                                partition: 0
                            }
                        ];
                        producer.send(payload, function (err, data) {
                            // console.log(data);
                        });
                        res.json({messages:'购买成功，还剩下'+parseInt(reply-1)+'个'})
                        client.end(true);
                    }
                });
            } else {
                res.json({messages:'抢完了'})
                client.end(true);
            }
        })
    };
    fn();
});

router.get('/getCount', function (req, res) {
 var client = redis.createClient(6379,"47.105.36.188",{password:"test123"});
   client.watch("counter");
   client.get("counter", function (err, reply) {
        res.json({num:parseInt(reply)})
       client.end(true);
   })

})
module.exports = router;