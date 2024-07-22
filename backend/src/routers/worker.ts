import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { authWorkerMiddleWare } from "../middleware";
import { getNextTask } from "../utils/libs";
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
          pending_amount:0,
          locked_amount:0
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
router.get("/nextTask",authWorkerMiddleWare,async (req,res)=>{
    // @ts-ignore
    const userId = req.userId;
    const task = getNextTask(userId);

    if(!task)
    {
        res.status(411).json({
            message:"no remaining task found for you"
        })
    }
    else
    {
        res.status(411).json({
            task
        })
    }

})

//get balance of the worker
router.get("/balance",authWorkerMiddleWare, async (req,res)=>{
    //@ts-ignore
    const userId = req.userId;

    const worker = await prismaClient.worker.findFirst({
        where:{
            id:userId
        }
    })

    res.json(411).json({
        pendingAmount : worker?.pending_amount,
        lockedAmount:worker?.locked_amount
    })
    
})
  



export default router;