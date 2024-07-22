import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { authWorkerMiddleWare } from "../middleware";
import { getNextTask, totalDecimal } from "../utils/libs";
import { createSubmissionInput } from "../types";
const router = Router();
const prismaClient = new PrismaClient();

//sign in with router
router.post("/signin", async (req, res) => {
  //add signature verification logic here

  // authentication
  const walletAddress = "flkadsfklasjfkasjdflkasdjfla";
  const existingUser = await prismaClient.worker.findFirst({
    where: {
      walletAddress: walletAddress,
    },
  });
  const JWTSecret = process.env.JWTWorkerSecret as string;

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWTSecret
    );

    res.json({ token });
  } else {
    const worker = await prismaClient.worker.create({
      data: {
        walletAddress: walletAddress,
        pending_amount: 0,
        locked_amount: 0,
      },
    });

    const token = jwt.sign(
      {
        userId: worker.id,
      },
      JWTSecret
    );
    res.json({ token });
  }
});

//get next task for user with no submission from user
router.get("/nextTask", authWorkerMiddleWare, async (req, res) => {
  // @ts-ignore
  const userId = req.userId;
  const task = await getNextTask(userId);

  if (!task) {
    res.status(411).json({
      message: "no remaining task found for you",
    });
  } else {
    res.status(411).json({
      task,
    });
  }
});

//get balance of the worker
router.get("/balance", authWorkerMiddleWare, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const worker = await prismaClient.worker.findFirst({
    where: {
      id: userId,
    },
  });

  res.json(411).json({
    pendingAmount: worker?.pending_amount,
    lockedAmount: worker?.locked_amount,
  });
});

//when worker submits a task
router.post("/submission", authWorkerMiddleWare, async (req, res) => {
  // @ts-ignore
  const workerId = req.userId;
  const body = req.body;

  const parsedBody = createSubmissionInput.safeParse(body);
  if (parsedBody.success) {
    const nextTask = await getNextTask(workerId);
    if (nextTask?.id !== Number(parsedBody.data.taskId)) {
      return res.status(411).json({
        message: "task id is not matching",
      });
    }
    const amount = (Number(nextTask.amount)/10000)*totalDecimal;

    const submissionTxn = await prismaClient.$transaction(async tx=>{
        const submission = await tx.submission.create({
            data:{
                worker_id:workerId,
                option_id:Number(parsedBody.data.selection),
                task_id:Number(parsedBody.data.taskId),
                amount
            }
        })

        await tx.worker.update({
            where:{
                id:workerId
            },
            data:{
                pending_amount:amount
            }

        })

        return submission;
    })
   
    const nextTaskToDisplay = await getNextTask(workerId);
    return res.status(411).json({
        nextTaskToDisplay,
        amount
    })
  }
});


//Paying out the worker
router.post("/payout",authWorkerMiddleWare,async(req,res)=>{
    // @ts-ignore
    const workerId = req.userId;
    const worker = await prismaClient.worker.findFirst({
        where:{
            id:workerId
        }
    })
    if(!worker)
    {
        return res.status(403).json({
            message:"worker not found!!!"
        })
    }

    const workerWalletAddress = worker.walletAddress;

    //create a txn ID from web 3 solana
    const txnID = "01sx213123123";

    //we should add a lock here so workers dont get there amount in negative
    await prismaClient.$transaction(async tx =>{
        await tx.worker.update({
            where:{
                id:workerId
            },
            data:{
                pending_amount:{
                    decrement:worker.pending_amount
                },
                locked_amount:{
                    increment:worker.pending_amount
                }
            }
        });
        await tx.payout.create({
            data:{
                userId:workerId,
                amount:worker.pending_amount,
                signature:txnID,
                status:"Processing",
            }
        })
    })

    res.status(411).json({
        status:"processing your payment",
        amount:worker.pending_amount
    })

})

export default router;
