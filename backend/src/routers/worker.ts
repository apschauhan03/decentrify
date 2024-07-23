import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { authWorkerMiddleWare } from "../middleware";
import { getNextTask, totalDecimal } from "../utils/libs";
import { createSubmissionInput } from "../types";
import nacl from "tweetnacl";
import { decode } from "bs58";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
const router = Router();
const prismaClient = new PrismaClient();
const connection = new Connection(process.env.NEXT_PUBLIC_NPC_SERVER as string);

//sign in with router
router.post("/signin", async (req, res) => {
  //add signature verification logic here
  const {publicKey,signature} = req.body;
  const message = new TextEncoder().encode("Sign in to Decentrify as a worker.");

  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes()
  )
  if(!result)
  {
    return res.status(411).json({
      message:"this public key does not match"
    })
  }

  // authentication
  const existingUser = await prismaClient.worker.findFirst({
    where: {
      walletAddress: publicKey,
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

    res.json({ token,balance:existingUser.pending_amount });
  } else {
    const worker = await prismaClient.worker.create({
      data: {
        walletAddress: publicKey,
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
    res.json({ token,balance:0 });
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
    res.json({
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


router.post("/submission", authWorkerMiddleWare, async (req, res) => {
  // @ts-ignore
  const userId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionInput.safeParse(body);

  if (parsedBody.success) {
      const task = await getNextTask(userId);
      if (!task || task?.id !== Number(parsedBody.data.taskId)) {
          return res.status(411).json({
              message: "Incorrect task id"
          })
      }

      const amount = (Number(task.amount) / 100).toString();

      const submission = await prismaClient.$transaction(async tx => {
          const submission = await tx.submission.create({
              data: {
                  option_id: Number(parsedBody.data.selection),
                  worker_id: userId,
                  task_id: Number(parsedBody.data.taskId),
                  amount: Number(amount)
              }
          })

          await tx.worker.update({
              where: {
                  id: userId,
              },
              data: {
                  pending_amount: {
                      increment: Number(amount)
                  }
              }
          })

          return submission;
      })

      const nextTask = await getNextTask(userId);
      res.json({
          nextTask,
          amount
      })
      

  } else {
      res.status(411).json({
          message: "Incorrect inputs"
      })
          
  }

})


//Paying out the worker
router.post("/payout", authWorkerMiddleWare, async (req, res) => {
  // @ts-ignore
  const userId: string = req.userId;
  const worker = await prismaClient.worker.findFirst({
      where: { id: Number(userId) }
  })

  if (!worker) {
      return res.status(403).json({
          message: "User not found"
      })
  }

  const transaction = new Transaction().add(
      SystemProgram.transfer({
          fromPubkey: new PublicKey(process.env.PARENT_WALLET_ADDRESS as string),
          toPubkey: new PublicKey(worker.walletAddress),
          lamports: 1000_000_000* worker.pending_amount / 10000000,
      })
  );


  console.log(worker.walletAddress);

  const keypair = Keypair.fromSecretKey(decode(process.env.PARENT_WALLET_ADDRESS_SECRET as string));

  // TODO: There's a double spending problem here
  // The user can request the withdrawal multiple times
  // Can u figure out a way to fix it?
  let signature = "";
  try {
      signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair],
      );
  
   } catch(e) {
    console.log(e);
    
      return res.json({
          message: "Transaction failed"
      })
   }
  
  console.log(signature)

  // We should add a lock here
  await prismaClient.$transaction(async tx => {
      await tx.worker.update({
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
      })

      await tx.payout.create({
          data: {
              userId: Number(userId),
              amount: worker.pending_amount,
              status: "Processing",
              signature: signature
          }
      })
  })

  res.json({
      message: "Processing payout",
      amount: worker.pending_amount
  })


})


export default router;
