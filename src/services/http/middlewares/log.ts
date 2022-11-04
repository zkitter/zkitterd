import { NextFunction, Request, Response } from 'express';
import logger from '../../../util/logger';

export const logBefore = async (req: Request, res: Response, next: NextFunction) => {
  logger.info('received request', {
    url: req.url,
  });
  next();
};

export const logAfter = async (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (!err) {
    logger.info('handled request', {
      url: req.url,
    });
  } else {
    console.log(err);
    logger.info('error handling request', {
      message: err.message,
      url: req.url,
    });

    res.status(500).send({
      payload: err.message,
      error: true,
    });
  }
};
