"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../middleware");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const s3Client = new client_s3_1.S3Client({
    credentials: {
        accessKeyId: "AKIA6ODU7E4O7GMYUKOZ",
        secretAccessKey: "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"
    },
    region: 'us-east-1'
});
//sign in with router
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //add signature verification logic here
    // authentication
    const walletAddress = "flkadsfklasjfkasjdflkasdjfla";
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            walletAddress: walletAddress
        }
    });
    const JWTSecret = process.env.JWTSecret;
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id
        }, JWTSecret);
        res.json({ token });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                walletAddress: walletAddress
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id
        }, JWTSecret);
        res.json({ token });
    }
}));
router.get("/generatepresignedurl", middleware_1.authMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const key = `content/${userId}/${Math.random()}/image.jpg`;
    const command = new client_s3_1.PutObjectCommand({
        Bucket: "decentrify-object-store",
        Key: key,
        // ContentType: "image/jpeg"
    });
    const preSignedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, {
        expiresIn: 360
    });
    console.log('====================================');
    console.log(preSignedUrl);
    console.log('====================================');
    res.json({
        preSignedUrl
    });
}));
exports.default = router;
