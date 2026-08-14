export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000'),
  },

  jwt: {
    secret: process.env.JWT_SECRET,

    expires: process.env.JWT_EXPIRES,
  },

  mqtt: {
    server: process.env.MQTT_SERVER,

    port: parseInt(process.env.MQTT_PORT || '1883'),

    user: process.env.MQTT_USER,

    password: process.env.MQTT_PASSWORD,
  },

  database: {
    host: process.env.DB_HOST,

    port: parseInt(process.env.DB_PORT || '5432'),

    user: process.env.DB_USER,

    password: process.env.DB_PASSWORD,

    database: process.env.DB_NAME,
  },
  camera: {
    url: process.env.CAMERA_URL,
  },
});
