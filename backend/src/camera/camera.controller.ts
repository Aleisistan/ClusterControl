import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import axios from 'axios';

@Controller('camera')
export class CameraController {

  @Get('stream')
  async stream(@Res() res: Response) {

    console.log('CAMERA STREAM URL:', process.env.CAMERA_STREAM_URL);
    

    const stream = await axios({
      method: 'get',
      url: process.env.CAMERA_STREAM_URL,
      responseType: 'stream'
    });

    res.setHeader(
      'Content-Type',
      'multipart/x-mixed-replace; boundary=frame'
    );

    stream.data.pipe(res);
  }
  // CAPTURA JPG
  @Get('capture')
  async capture(@Res() res: Response) {

     const image = await axios({
    method: 'get',
    url: process.env.CAMERA_CAPTURE_URL,
    responseType: 'arraybuffer'
  });

  res.setHeader('Content-Type', 'image/jpeg');

  res.send(image.data);
}
}