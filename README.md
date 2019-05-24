# 前言
偶然在头条看到一篇文章[原文](https://www.jianshu.com/p/c18e61d0726c)，准备自己试一试，由于是几年前的文章，现在按照教程遇到很多坑，花了几天终于填平。
# 业务特点![在这里插入图片描述](https://img-blog.csdnimg.cn/20190524113552967.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3EzNTg1OTE0,size_16,color_FFFFFF,t_70)
# 技术点
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190524114316933.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3EzNTg1OTE0,size_16,color_FFFFFF,t_70)
JMeter：用JMeter来模拟秒杀活动中大量并发的用户请求

Seckill Service：基于Nodejs使用Express实现的秒杀service，图中的步骤2，3，4都是在这个service中处理的

Redis：一个Redis的docker container，在其中保存一个名为counter的数据来表示当前剩余的库存大小

Kafka: 一个Kafka的docker container，其实这里还有一个zookeeper的docker container，Kafka用zookeeper来存放一些元数据，在程序中并没有涉及到，所以也就不单独列出来说了。Seckill service在更新完Redis之后，会发送一条消息给Kafka表示一次成功的秒杀

Seckill Kafka Consumer: 基于Nodejs的Kafka consumer，会从Kafka中去获取秒杀成功的消息，处理并且存储到MySQL中
MySQL：一个MySQL的docker container，最终秒杀成功的请求都会对应着数据库表中的一条记录

# 前端页面
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190524131855332.gif)
# 环境搭建
## 1.安装JMeter，进行接口压力测试
下载地址[添加链接描述](http://mirrors.tuna.tsinghua.edu.cn/apache//jmeter/binaries/apache-jmeter-5.1.1.tgz)
首先更改为中文，右击左边菜单，添加->线程（用户）->线程组-> 线程数->2000->时间5秒
右击线程组 ->添加 ->取样器 ->http请求
设置 127.0.0.1 端口 3030 post请求 请求路径seckill/seckill
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190524132654764.gif)
## 2.使用Docker安装Redis

```shell
mkdir -p /var/www/redis /var/www/redis/data
docker pull  redis
cd /var/www/redis 
创建 redis.conf 下载http://download.redis.io/redis-stable/redis.conf
找到bind 127.0.0.1，把这行前面加个#注释掉
再查找protected-mode yes 把yes修改为no

docker run -p 6379:6379 --name myredis -v /var/www/redis/redis.conf:/etc/redis/redis.conf -v /var/www/redis/data:/data -d redis redis-server /etc/redis/redis.conf --appendonly yes
进入redis
docker exec -i -t e60da5191243 /bin/bash  
加载配置
redis-server redis.conf
设置密码在配置中修改或者直接
requirepass 密码

redis-cli -a test123
config set requirepass 新密码

```

## 3.使用Docker安装mysql

第二种docker pull mysql:5.6

我们新建一个目录,自己随意

```go
mkdir -p /var/www/mysql/data /var/www/mysql/logs /var/www/mysql/conf
```
**第二步然后新建my.cnf**，
这个是mysql的配置文件，在使用docker创建mysql，当容器删除，mysql的数据就会清空，这个时候我们需要把mysql的配置、数据、日志从容器内映射到容器外，这样数据就保持下来了

```go
[mysqld]
datadir=/var/lib/mysql
socket=/var/lib/mysql/mysql.sock
symbolic-links=0
sql_mode=NO_ENGINE_SUBSTITUTION,STRICT_TRANS_TABLES
character_set_server=utf8mb4
init_connect='SET NAMES utf8mb4'
default-storage-engine=INNODB
collation-server=utf8mb4_general_ci
user=mysql
port=3306
bind-address=0.0.0.0

[mysqld_safe]
log-error=/var/log/mysqld.log
pid-file=/var/run/mysqld/mysqld.pid

[client]
default-character-set=utf8mb4

```
第三步启动容器设置外网访问

```go
docker run -p 3306:3306 --name mymysql -v $PWD/conf/my.cnf:/var/www/mysql/my.cnf -v $PWD/logs:/var/www/mysql/logs -v $PWD/data:/var/www/mysql/data -e MYSQL_ROOT_PASSWORD=pass1234 -d mysql:5.6

docker exec -it mymysql bash
 grant all privileges on *.* to root@"%" identified by "password" with grant optio
```

## 4.安装Kafka和zookeeper
这个单独安装有点坑，查询了官网，执行docker-compose.yml来安装吧，可以外网访问
还有几种yml安装方法 
最新[github的docker-compose.yml](https://github.com/wurstmeister/kafka-docker/blob/master/docker-compose.yml) 
[docker-compose-swarm.yml](https://github.com/wurstmeister/kafka-docker/blob/master/docker-compose-swarm.yml)
```yml
version: '3.2'
services:
  zookeeper:
    image: wurstmeister/zookeeper
    ports:
      - "2181:2181"
  kafka:
    image: wurstmeister/kafka:latest
    ports:
      - "9092:9092"
    environment:
      KAFKA_ADVERTISED_HOST_NAME: 47.105.36.188
      KAFKA_CREATE_TOPICS: "test:1:1"
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

然后使用 docker-compose up -d 后台运行启动，如果想测试，你可以在服务器上测试代码如下或者下载Kafka Tool 工具查看

```go
// 进入kafka  （提示没找到 kafka ，使用docker ps 看id）
docker exec -ti kafka /bin/bash
cd /opt/kafka_2.12-2.2.0
创建主题 topic
./bin/kafka-topics.sh --create --zookeeper 47.105.36.188:2181 --replication-factor 1 --partitions 1 --topic mykafka
#查看主题 
bin/kafka-topics.sh --list --zookeeper 47.105.36.188:2181
发送消息
./bin/kafka-console-producer.sh --broker-list 47.105.36.188:9092 --topic mykafka
接受
bin/kafka-console-producer.sh --broker-list 47.105.36.188:9092 --topic mykafka
```

## 5.创建必要数据
1.MySQL容器中创建一个名为seckill的数据表
2.Redis容器中创建一个名为counter的计数器（设置值为1000，代表库存初始值为1000）
3.需要去Kafka容器中创建一个名为CAR_NUMBER的topic（可以不需要）
```sql
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for seckill
-- ----------------------------
DROP TABLE IF EXISTS `seckill`;
CREATE TABLE `seckill`  (
  `Id` int(11) NOT NULL AUTO_INCREMENT,
  `info` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `date` timestamp(0) NULL DEFAULT NULL,
  `offset` int(255) NULL DEFAULT NULL,
  PRIMARY KEY (`Id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 59964 CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;

```

## 6.代码解析
# 1.前端页面接口和设置了定时器查询数量

```js
   <section class="_ms_box">
        <div class="uf _uf_center img_box">第一个商品</div>
        <div class="but_box">
            <div id="num" class="uf _uf_center number">剩余数量:--</div>
            <div id="button" class="submit uf _uf_center button rosy" onclick="buy()">秒杀</button>
            </div>
    </section>
    
   var job = setInterval(function () {
            $.ajax({
                type: 'get',
                url: 'seckill/getCount',
                success: function (result) {
                    if (result.num > 0) {
                        $("#num").html("剩余数量:" + result.num);
                        $("#button").css("background", "#e77005")
                    } else {
                        $("#num").html("剩余数量:0");
                        $("#button").css("background", "#ccc")
                        window.clearInterval(job)
                    }
                }

            })

        }, 1000)

 function buy() {
        if (isbuy) {
            alert("不能购买")
        } else {
            $.ajax({
                type: 'post',
                url: 'seckill/seckill',
                success: function (result) {
                    alert(result.messages)
                }
            })
        }
    }
```
# 2.Kafka 消费者

```js
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
    password: '',
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

```
由于node.js 代码的特殊性，所以定义了一个队列来接受处理数据，也是官方最新推荐的写法
## How to throttle messages / control the concurrency of processing messages
Create a **async.queue** with message processor and concurrency of one (the message processor itself is wrapped with setImmediate so it will not freeze up the event loop)
Set the queue.drain to resume the consumer
The handler for consumer's message event pauses the consumer and pushes the message to the queue.
然后由于Kafka是批量接收消息，循环接受消息，所以我在首次启动获取最大偏移值，再初始化，这样就可以从最新数据获取

```go
  consumer = new Consumer(
            client,
            [
                {topic: 'CAR_NUMBER', partition: 0, offset: parkTopicsNum}
            ],
```
然后每次插入先查询是否插入再保存，然后初始化Consumer的配置大家可以看注释增加

## 3.秒杀接口

```go
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
```

redis自己有断开机制，我就没有手动去处理连接池问题，
由于在并发条件下，redis获取了库存，然后原子减库存，如果分开写，会出现，查有库存，减的时候就没有了。所有有直接一起写，另外也要查询后做出判断


Kafka 生产数据是

```js
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
```


接下来是测试了
1.redis设置库存1000
![我](https://img-blog.csdnimg.cn/20190524135833153.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3EzNTg1OTE0,size_16,color_FFFFFF,t_70)
2.Jmeter设置2000并发
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190524135924280.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3EzNTg1OTE0,size_16,color_FFFFFF,t_70)
启动Jmeter
![在这里插入图片描述](https://img-blog.csdnimg.cn/20190524140042215.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3EzNTg1OTE0,size_16,color_FFFFFF,t_70)
![在这里插入图片描述](https://img-blog.csdnimg.cn/2019052414211946.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3EzNTg1OTE0,size_16,color_FFFFFF,t_70)
最后redis中的counter变成0，seckill数据表中会插入1000条记录

感谢[原文](https://www.jianshu.com/p/c18e61d0726c) 提供的经验。 

项目源码地址：[miaosha](https://github.com/harryluo163/miaosha)