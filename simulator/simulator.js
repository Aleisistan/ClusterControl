const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://mosquitto:1883');

client.on('connect', () => {

  console.log('Simulador conectado');

  setInterval(() => {

    const china = {
      deviceId: 34,
      temp1: 28 + Math.random() * 8,
      hum1: 35 + Math.random() * 10,
      temp2: 30 + Math.random() * 5,
      hum2: 40 + Math.random() * 10,
      extractor: false,
      aire: true,
      puerta: false
    };

    client.publish(
      'datacenter/ambiente',
      JSON.stringify(china)
    );

  }, 15000);

  setInterval(() => {

    const saopaulo = {
      deviceId: 35,
      temp1: 18 + Math.random() * 7,
      hum1: 65 + Math.random() * 15,
      temp2: 20 + Math.random() * 5,
      hum2: 70 + Math.random() * 10,
      extractor: true,
      aire: false,
      puerta: false
    };

    client.publish(
      'datacenter/ambiente',
      JSON.stringify(saopaulo)
    );

  }, 15000);

});