import {Request, Response,NextFunction} from 'express';
import jwt, { JwtPayload } from "jsonwebtoken";

export function authMiddleWare(req:Request,res:Response,next:NextFunction){
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try{
        const jwtSecret = process.env.JWTSecret as string;
        const decoded = jwt.verify(authHeader,jwtSecret) as JwtPayload;
        if(decoded.userId)
        {
            // @ts-ignore
            req.userId = decoded.userId;
            return next();
        }
    }
    catch(e)
    {
        console.log('====================================');
        console.log("error occured in the middleware",e);
        console.log('====================================');
        return res.status(404).json({message:'user not signed in'});
    }
}



export function authWorkerMiddleWare(req:Request,res:Response,next:NextFunction){
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try{
        const jwtSecret = process.env.JWTWorkerSecret as string;
        const decoded = jwt.verify(authHeader,jwtSecret) as JwtPayload;
        if(decoded.userId)
        {
            // @ts-ignore
            req.userId = decoded.userId;
            return next();
        }
    }
    catch(e)
    {
        console.log('====================================');
        console.log("error occured in the middleware",e);
        console.log('====================================');
        return res.status(404).json({message:'user not signed in'});
    }
}