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
const libs_1 = require("../utils/libs");
const types_1 = require("../types");
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
                locked_amount: 0,
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
    const task = yield (0, libs_1.getNextTask)(userId);
    if (!task) {
        res.status(411).json({
            message: "no remaining task found for you",
        });
    }
    else {
        res.status(411).json({
            task,
        });
    }
}));
//get balance of the worker
router.get("/balance", middleware_1.authWorkerMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: userId,
        },
    });
    res.json(411).json({
        pendingAmount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
        lockedAmount: worker === null || worker === void 0 ? void 0 : worker.locked_amount,
    });
}));
//when worker submits a task
router.post("/submission", middleware_1.authWorkerMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const workerId = req.userId;
    const body = req.body;
    const parsedBody = types_1.createSubmissionInput.safeParse(body);
    if (parsedBody.success) {
        const nextTask = yield (0, libs_1.getNextTask)(workerId);
        if ((nextTask === null || nextTask === void 0 ? void 0 : nextTask.id) !== Number(parsedBody.data.taskId)) {
            return res.status(411).json({
                message: "task id is not matching",
            });
        }
        const amount = (Number(nextTask.amount) / 10000) * libs_1.totalDecimal;
        const submissionTxn = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const submission = yield tx.submission.create({
                data: {
                    worker_id: workerId,
                    option_id: Number(parsedBody.data.selection),
                    task_id: Number(parsedBody.data.taskId),
                    amount
                }
            });
            yield tx.worker.update({
                where: {
                    id: workerId
                },
                data: {
                    pending_amount: amount
                }
            });
            return submission;
        }));
        const nextTaskToDisplay = yield (0, libs_1.getNextTask)(workerId);
        return res.status(411).json({
            nextTaskToDisplay,
            amount
        });
    }
}));
//Paying out the worker
router.post("/payout", middleware_1.authWorkerMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const workerId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: workerId
        }
    });
    if (!worker) {
        return res.status(403).json({
            message: "worker not found!!!"
        });
    }
    const workerWalletAddress = worker.walletAddress;
    //create a txn ID from web 3 solana
    const txnID = "01sx213123123";
    //we should add a lock here so workers dont get there amount in negative
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: workerId
            },
            data: {
                pending_amount: {
                    decrement: worker.pending_amount
                },
                locked_amount: {
                    increment: worker.pending_amount
                }
            }
        });
        yield tx.payout.create({
            data: {
                userId: workerId,
                amount: worker.pending_amount,
                signature: txnID,
                status: "Processing",
            }
        });
    }));
    res.status(411).json({
        status: "processing your payment",
        amount: worker.locked_amount
    });
}));
exports.default = router;
