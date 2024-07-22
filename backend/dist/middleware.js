"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleWare = authMiddleWare;
exports.authWorkerMiddleWare = authWorkerMiddleWare;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleWare(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const jwtSecret = process.env.JWTSecret;
        const decoded = jsonwebtoken_1.default.verify(authHeader, jwtSecret);
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;
            return next();
        }
    }
    catch (e) {
        console.log('====================================');
        console.log("error occured in the middleware", e);
        console.log('====================================');
        return res.status(404).json({ message: 'user not signed in' });
    }
}
function authWorkerMiddleWare(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const jwtSecret = process.env.JWTWorkerSecret;
        const decoded = jsonwebtoken_1.default.verify(authHeader, jwtSecret);
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;
            return next();
        }
    }
    catch (e) {
        console.log('====================================');
        console.log("error occured in the middleware", e);
        console.log('====================================');
        return res.status(404).json({ message: 'user not signed in' });
    }
}
