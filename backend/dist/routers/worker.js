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
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const bs58_1 = require("bs58");
const web3_js_1 = require("@solana/web3.js");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
const connection = new web3_js_1.Connection(process.env.NEXT_PUBLIC_NPC_SERVER);
//sign in with router
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //add signature verification logic here
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign in to Decentrify as a worker.");
    const result = tweetnacl_1.default.sign.detached.verify(message, new Uint8Array(signature.data), new web3_js_1.PublicKey(publicKey).toBytes());
    if (!result) {
        return res.status(411).json({
            message: "this public key does not match"
        });
    }
    // authentication
    const existingUser = yield prismaClient.worker.findFirst({
        where: {
            walletAddress: publicKey,
        },
    });
    const JWTSecret = process.env.JWTWorkerSecret;
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id,
        }, JWTSecret);
        res.json({ token, balance: existingUser.pending_amount });
    }
    else {
        const worker = yield prismaClient.worker.create({
            data: {
                walletAddress: publicKey,
                pending_amount: 0,
                locked_amount: 0,
            },
        });
        const token = jsonwebtoken_1.default.sign({
            userId: worker.id,
        }, JWTSecret);
        res.json({ token, balance: 0 });
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
        res.json({
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
// router.post("/submission", authWorkerMiddleWare, async (req, res) => {
//   // @ts-ignore
//   const workerId = req.userId;
//   const body = req.body;
//   const parsedBody = createSubmissionInput.safeParse(body);
//   if (parsedBody.success) {
//     const nextTask = await getNextTask(workerId);
//     if (nextTask?.id !== Number(parsedBody.data.taskId)) {
//       return res.status(411).json({
//         message: "task id is not matching",
//       });
//     }
//     const amount = (Number(nextTask.amount)/10000)*totalDecimal;
//     const submissionTxn = await prismaClient.$transaction(async tx=>{
//         const submission = await tx.submission.create({
//             data:{
//                 worker_id:workerId,
//                 option_id:Number(parsedBody.data.selection),
//                 task_id:Number(parsedBody.data.taskId),
//                 amount
//             }
//         })
//         await tx.worker.update({
//             where:{
//                 id:workerId
//             },
//             data:{
//                 pending_amount:amount
//             }
//         })
//         return submission;
//     })
//     const nextTaskToDisplay = await getNextTask(workerId);
//     return res.json({
//         nextTaskToDisplay,
//         amount
//     })
//   }
// });
router.post("/submission", middleware_1.authWorkerMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parsedBody = types_1.createSubmissionInput.safeParse(body);
    if (parsedBody.success) {
        const task = yield (0, libs_1.getNextTask)(userId);
        if (!task || (task === null || task === void 0 ? void 0 : task.id) !== Number(parsedBody.data.taskId)) {
            return res.status(411).json({
                message: "Incorrect task id"
            });
        }
        const amount = (Number(task.amount) / 100).toString();
        const submission = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const submission = yield tx.submission.create({
                data: {
                    option_id: Number(parsedBody.data.selection),
                    worker_id: userId,
                    task_id: Number(parsedBody.data.taskId),
                    amount: Number(amount)
                }
            });
            yield tx.worker.update({
                where: {
                    id: userId,
                },
                data: {
                    pending_amount: {
                        increment: Number(amount)
                    }
                }
            });
            return submission;
        }));
        const nextTask = yield (0, libs_1.getNextTask)(userId);
        res.json({
            nextTask,
            amount
        });
    }
    else {
        res.status(411).json({
            message: "Incorrect inputs"
        });
    }
}));
//Paying out the worker
router.post("/payout", middleware_1.authWorkerMiddleWare, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: { id: Number(userId) }
    });
    if (!worker) {
        return res.status(403).json({
            message: "User not found"
        });
    }
    const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
        fromPubkey: new web3_js_1.PublicKey(process.env.PARENT_WALLET_ADDRESS),
        toPubkey: new web3_js_1.PublicKey(worker.walletAddress),
        lamports: 1000000000 * worker.pending_amount / 10000000,
    }));
    console.log(worker.walletAddress);
    const keypair = web3_js_1.Keypair.fromSecretKey((0, bs58_1.decode)(process.env.PARENT_WALLET_ADDRESS_SECRET));
    // TODO: There's a double spending problem here
    // The user can request the withdrawal multiple times
    // Can u figure out a way to fix it?
    let signature = "";
    try {
        signature = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [keypair]);
    }
    catch (e) {
        console.log(e);
        return res.json({
            message: "Transaction failed"
        });
    }
    console.log(signature);
    // We should add a lock here
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: Number(userId)
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
                userId: Number(userId),
                amount: worker.pending_amount,
                status: "Processing",
                signature: signature
            }
        });
    }));
    res.json({
        message: "Processing payout",
        amount: worker.pending_amount
    });
}));
exports.default = router;
