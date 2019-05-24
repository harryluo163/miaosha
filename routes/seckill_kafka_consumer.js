var kafka = require('kafka-node');
Consumer = kafka.Consumer;
var kafkaClient = kafka.Client;
var client = new kafkaClient('47.105.36.188:2181');
var parkTopicsNum = 0;
var async = require('async')
var mysql = require('mysql');
var timeoutObj = "", consumer = ""
var connection = mysql.createConnection({
    host: '47.105.36.188',
    user: 'root',
    password: 'Root!!2018',
    database: 'seckill'
});

connection.connect();


// 定义一个队列进行数据保存
var q = async.queue(function (message, callback) {
    async.waterfall([
        function (cb) {
            //查询数据库中是否存在
            connection.query("select count(1) num  from seckill where info='"+  message.value +"'", function (error, results, fields) {
                cb(null, results[0].num == 0);
            })
        }, function (data, cb) {
            //不存在就插入
            if (data) {
                connection.query('INSERT INTO seckill set ?', {
                    date: new Date(),
                    info: message.value,
                    offset: message.offset
                }, function (error, results, fields) {
                    if (error) {
                        console.error(error);
                    }
                    callback();
                })
            }

        }
    ])


}, 2);
//worker数量将用完时，会调用saturated函数
q.saturated = function () {
    console.log("all workers to be used");
}
//当最后一个任务交给worker执行时，会调用empty函数
q.empty = function () {
    console.log("no more tasks wating");
}
//当所有任务都执行完时，会调用drain函数
q.drain = function () {
    console.log("all tasks have been processed");
}


function consumerdo() {
    //获取最大偏移值，再初始化
    connection.query('select max(offset) as offset from seckill', function (error, results, fields) {
        if (results[0].offset != null) {
            parkTopicsNum = results[0].offset;
        } else {
            parkTopicsNum = 0
        }

        //设置消费者读取偏移值
        consumer = new Consumer(
            client,
            [
                {topic: 'CAR_NUMBER', partition: 0, offset: parkTopicsNum}
            ],
            {
                groupId: 'kafka-node-group',//使用者组ID，默认`kafka-node-group` 
                //自动提交配置 
                autoCommit: false,
                autoCommitIntervalMs: 5000,
                //最长等待时间是最长时间如果在发出请求时数据不足,则以毫秒为单位阻止等待，默认为100ms
                fetchMaxWaitMs: 100,
                //  //这是必须可用于提供响应的消息的最小字节数，默认为1字节 
                fetchMinBytes: 1,
                // 要包含在此分区的消息集中的最大字节数。这有助于限制响应的大小.
                fetchMaxBytes: 1024 * 1024,
                // 如果设置为true，则consumer将从有效负载中的给定偏移量中获取消息 
                fromOffset: true,
                // 如果设置为“buffer”，则值将作为原始缓冲区对象返回。
                encoding: 'utf8',
                keyEncoding: 'utf8'
            }
        );

        consumer.on('message', function (message) {


            if (message.offset > parkTopicsNum) {
                //偏移值+1
                parkTopicsNum += 1;
                q.push(message)
            }

        });

        consumer.on("error", function (message) {
            console.log(message);
            console.log("kafka错误");
        });

    })
}


exports.consumerdo = consumerdo

