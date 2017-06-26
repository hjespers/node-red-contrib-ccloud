"use strict";
module.exports = function(RED) {
    var Kafka = require('node-rdkafka');
    var util = require("util");

    function CCloudBrokerNode(n) {
        RED.nodes.createNode(this, n);
        this.broker = n.broker;
        this.clientid = n.clientid;
        if (this.credentials) {
            this.apikey = this.credentials.apikey;
            this.apisecret = this.credentials.apisecret;
            this.sslcaloc = this.credentials.sslcaloc;
        }  
    }
    RED.nodes.registerType("ccloud-broker", CCloudBrokerNode, {
        credentials: {
            apikey: { type: "password" },
            apisecret: { type: "password" },
            sslcaloc: { type: "text"}
        }        
    });

    function CCloudInNode(n) {
        RED.nodes.createNode(this, n);
        this.topic = n.topic;
        this.broker = n.broker;
        this.cgroup = n.cgroup;
        this.autocommit = n.autocommit;
        this.brokerConfig = RED.nodes.getNode(this.broker);
        var node = this;
        var consumer;
        //var topic = this.topic;
        if (node.brokerConfig !== undefined) {
            node.status({
                fill: "red",
                shape: "ring",
                text: "disconnected"
            });
            if (node.topic !== undefined) {  
                // subscribe to kafka topic (if provided), otherwise print error message
                try {   
                    // create node-rdkafka consumer      
                    consumer = new Kafka.KafkaConsumer({
                        'group.id': node.cgroup,
                        'client.id': node.brokerConfig.clientid,
                        'metadata.broker.list': node.brokerConfig.broker,
                        'socket.keepalive.enable': true,
                        'enable.auto.commit': node.autocommit,
                        'queue.buffering.max.ms': 1,
                        'fetch.min.bytes': 1,
                        'fetch.wait.max.ms': 1,         //librkafka recommendation for low latency 
                        'fetch.error.backoff.ms': 100,  //librkafka recommendation for low latency
                        'security.protocol': 'sasl_ssl',
                        'sasl.mechanisms': 'PLAIN',
                        'sasl.username': node.brokerConfig.apikey,
                        'sasl.password': node.brokerConfig.apisecret,
                        'ssl.ca.location': node.brokerConfig.sslcaloc,
                        'api.version.request': true
                    }, {});

                    // Setup Flowing mode
                    consumer.connect();
                
                    // consumer event handlers
                    consumer
                        .on('ready', function() {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: "connected"
                            });  
                            consumer.subscribe([node.topic]);
                            consumer.consume();
                            util.log('[ccloud] Created consumer subscription on topic = ' + node.topic);
                        })
                        .on('data', function(data) {
                            // Output the actual message contents
                            var msg = {
                                topic: data.topic,
                                offset: data.offset,
                                partition: data.partition,
                                size: data.size
                            };
                            if (data.value) {
                                msg.payload = data.value.toString();
                            } else {
                                msg.payload = ""; //in case of msg with null value
                            }
                            if (data.key) {
                                msg.key = data.key.toString();
                            }
                            try {
                                node.send(msg);
                            } catch(e) {
                                // statements
                                util.log('[ccloud] error sending node message: ' +e);
                            }
                        })
                        .on('error', function(err) {
                            // Here's where we'll know if something went wrong consuming from Kafka
                            console.error('[ccloud] Error in our kafka consumer');
                            console.error(err);
                        });
                } catch(e) {
                    util.log('[ccloud] Error creating consumer connection:' +e);
                }
            } else {
                node.error('missing input topic');
            }
        } else {
            node.error("missing broker configuration");
        }
        node.on('close', function() {
            consumer.unsubscribe([node.topic]);
            consumer.disconnect();
        });
    }
    RED.nodes.registerType("ccloud in", CCloudInNode);

    function CCloudOutNode(n) {
        RED.nodes.createNode(this, n);
        this.topic = n.topic;
        this.broker = n.broker; 
        this.key = n.key;
        this.partition = Number(n.partition);             
        this.brokerConfig = RED.nodes.getNode(this.broker);
        var node = this;
        var producer;
        if (node.brokerConfig !== undefined) {
            this.status({
                fill: "red",
                shape: "ring",
                text: "disconnected"
            });

            try {
                producer = new Kafka.Producer({
                    'client.id': node.brokerConfig.clientid,
                    'metadata.broker.list': node.brokerConfig.broker,
                    //'compression.codec': 'gzip',
                    'retry.backoff.ms': 200,
                    'message.send.max.retries': 15,
                    'socket.keepalive.enable': true,
                    'queue.buffering.max.messages': 100000,
                    'queue.buffering.max.ms': 10,
                    'batch.num.messages': 1000000,
                    'security.protocol': 'sasl_ssl',
                    'sasl.mechanisms': 'PLAIN',
                    'sasl.username': node.brokerConfig.apikey,
                    'sasl.password': node.brokerConfig.apisecret,
                    'ssl.ca.location': node.brokerConfig.sslcaloc,
                    'api.version.request': true //added to force 0.10.x style timestamps on all messages
                });  

                // Connect to the broker manually
                producer.connect();

                producer.on('ready', function() {
                    util.log('[ccloud] Confluent Cloud connection is ready');
                    // this is the main part of this program
                    // call the REST API in order get login and get the id, vehicle_id, and streaming password token
                    // Wait for the ready event before proceeding
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: "connected"
                    });
                });

                // Any errors we encounter, including connection errors
                producer.on('error', function(err) {
                    console.error('[ccloud] Error from producer: ' + err);
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "error"
                    });  
                });

            } catch(e) {
                console.log(e);
            }


            this.on("input", function(msg) {
                //handle different payload types including JSON object
                var partition, key, topic, value, timestamp;
                //set the partition  
                if (this.partition && Number.isInteger(this.partition) && this.partition >= 0){
                    partition = this.partition;
                } else if(msg.partition && Number.isInteger(msg.partition) && Number(msg.partition) >= 0) {
                    partition = Number(msg.partition);
                } else {
                    partition = -1;
                }
                //set the key
                //if ((typeof this.key === 'string') && this.key !== "") {
                if ( this.key ) {
                    key = this.key;
                //} else if ((typeof msg.key === 'string') && msg.key !== "") {
                } else if ( msg.key ) {
                    key = msg.key;
                } else {
                    key = null;
                }
                //set the topic
                if (this.topic === "" && msg.topic !== "") {
                    topic = msg.topic;
                } else {
                    topic = this.topic;
                }
                //set the value
                if( typeof msg.payload === 'object') {
                    value = JSON.stringify(msg.payload);
                } else {
                    value = msg.payload.toString();
                }
                //set the timestamp
                if( (new Date(msg.timestamp)).getTime() > 0 ) {
                    timestamp = msg.timestamp;
                } else if (msg.timestamp !== undefined) {
                    console.log('[ccloud] WARNING: Ignoring the following invalid timestamp on message:' + msg.timestamp);    
                }
     
                //if (msg === null || (msg.topic === "" && node.topic === "")) {
                if (value === null || topic === "") {                    
                    util.log("[ccloud] request to send a NULL message or NULL topic");
                } else {
                    producer.produce(
                      topic,                                // topic
                      partition,                            // partition
                      new Buffer(JSON.stringify(value)),    // value
                      key,                                  // key
                      timestamp                             // timestamp
                    );                    
                }
            });
        } else {
            this.error("[ccloud] missing broker configuration");
        }
        this.on('close', function() {
            producer.disconnect();
        });
    }
    RED.nodes.registerType("ccloud out", CCloudOutNode);

};
