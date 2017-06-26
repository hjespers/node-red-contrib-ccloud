node-red-contrib-ccloud
========================

Node-RED (http://nodered.org) nodes for publish/subscribe messaging using the Confluent Cloud Apache Kafka as a service offering.


# Dependencies

Linux dependencies

* openssl-dev
* libsasl2-dev
* libsasl2-modules
* C++ toolchain

macOS dependencies

* Brew
* Apple Xcode command line tools (for the compiler)
* openssl via Brew
* Export CPPFLAGS=-I/usr/local/opt/openssl/include and LDFLAGS=-L/usr/local/opt/openssl/lib
* Open Keychain Access, export all certificates in System Roots to a single .pem file

# Install

Install all dependancies, node.js, and node-red

Install node-red-contrib-ccloud from sources
	
	cd /tmp	
	git clone git@github.com:confluentinc/node-red-contrib-ccloud.git
	cd ~/.node-red	
	npm install /tmp/node-red-contrib-ccloud


Install using npm (*not yet published*)

	cd ~/.node-red
	npm install node-red-contrib-ccloud

You may see a lot of warnings as librdkafka compiles and installs, particularily about sasl on macOS but it does work.

Start node-red as normal or with `-v` for better debugging

	node-red -v

Point your browser to http://localhost:1880

You should see ccloud input and output nodes in the pallet on the left side of the screen.
<ul>
    <img src="./images/ccloud-in.png">
    <img src="./images/ccloud-out.png">
</ul>

Drag either ccloud node to the canvas and double click to configure the topic, brokers, clientID and groupID.

<img src="./images/ccloud-in-config.png">

Click on the pencil icon to the right of the broker selection box to configure a kafka broker connection if one does not already exist.

<img src="./images/ccloud-broker-config.png">

Publish and subscribe just as you would with the mqtt node with some small differences namely:
<ul>
	<li>topics should not contain "/" or "." characters
	<li>kafka wildcard/regex subscriptions are not yet fully tested
	<li>ensure you have unique Group IDs configured unless you want multiple consumers to be in a Kafka consumer group
</ul>

# Author

Hans Jespersen, https://github.com/hjespers

# Feedback and Support

For more information, feedback, or support see https://github.com/confluentinc/node-red-contrib-ccloud/issues
