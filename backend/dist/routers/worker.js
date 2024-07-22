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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../middleware");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
//sign in with router
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //add signature verification logic here
    // authentication
    const walletAddress = "flkadsfklasjfkasjdflkasdjfla";
    const existingUser = yield prismaClient.worker.findFirst({
        where: {
            walletAddress: walletAddress,
        },
    });
    const JWTSecret = process.env.JWTWorkerSecret;
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id,
        }, JWTSecret);
        res.json({ token });
    }
    else {
        const worker = yield prismaClient.worker.create({
            data: {
                walletAddress: walletAddress,
                pending_amount: 0,
                locked_amount: 0
            },
        });
        const token = jsonwebtoken_1.default.sign({
            userId: worker.id,
        }, JWTSecret);
        res.json({ token });
    }
}));
//get next task for user with no submission from user
router.get("/nextTask", middleware_1.authWorkerMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const task = yield prismaClient.task.findFirst({
        where: {
            done: false,
            submissions: {
                none: {
                    worker_id: userId,
                }
            }
        },
        select: {
            title: true,
            options: true
        }
    });
    if (!task) {
        res.status(411).json({
            message: "no remaining task found for you"
        });
    }
    else {
        res.status(411).json({
            task
        });
    }
}));
exports.default = router;
