import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import jwt from "jsonwebtoken";
import { authMiddleWare } from "../middleware";
import { createTaskInput } from "../types";
import { totalDecimal } from "../utils/libs";
const router = Router();

const prismaClient = new PrismaClient();
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.Access_Key_Id as string,
    secretAccessKey: process.env.Secret_Access_Key as string,
  },
  region: "us-east-1",
});

//sign in with router
router.post("/signin", async (req, res) => {
  //add signature verification logic here

  // authentication
  const walletAddress = "flkadsfklasjfkasjdflkasdjfla";
  const existingUser = await prismaClient.user.findFirst({
    where: {
      walletAddress: walletAddress,
    },
  });
  const JWTSecret = process.env.JWTSecret as string;

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWTSecret
    );

    res.json({ token });
  } else {
    const user = await prismaClient.user.create({
      data: {
        walletAddress: walletAddress,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWTSecret
    );
    res.json({ token });
  }
});

router.get("/generatepresignedurl", authMiddleWare, async (req, res) => {
  // @ts-ignore
  const userId = req.userId;
  const key = `content/${userId}/${Math.random()}/image.jpg`;
  const command = new PutObjectCommand({
    Bucket: "decentrify-object-store",
    Key: key,
    // ContentType: "image/jpeg"
  });

  const preSignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 360,
  });

  console.log("====================================");
  console.log(preSignedUrl);
  console.log("====================================");

  res.json({
    preSignedUrl,
  });
});

router.get("/task",authMiddleWare,async(req,res)=>{
  
  // @ts-ignore
  const user_id = req.userId;
  const task_id = req.query.taskid;
  const taskDetails = await prismaClient.task.findFirst({
    where:{
      user_id:user_id,
      id:Number(task_id)
    },
    include:{
      options:true
    }
  })

  if(!taskDetails)
  {
    return res.status(411).json({
      message:"the task is missing"
    })
  }
  

  const submissions = await prismaClient.submission.findMany({
    where:{
      task_id:Number(task_id)
    },
    include:{
      option:true
    }
  })

  const result : Record<string,{
    count:number,
    option:{
      imageUrl:string
    }
  }>={};

  taskDetails.options.forEach((option)=>{
    result[option.id]={
      count:0,
      option:{
        imageUrl:option.image_url
      }
    }
  });

  submissions.forEach(submission => {
    result[submission.option_id].count++;
  });


  res.json({
    result
  })
})

router.post("/task", authMiddleWare, async (req, res) => {
  const body = req.body;
  const parsedBody = createTaskInput.safeParse(body);
  // @ts-ignore
  const userId = req.userId;

  if (!parsedBody.success) {
    return res.status(411).json({
      message: "inputs are not valid"
    });
  }

  const response = await prismaClient.$transaction(async (tx) => {
    const response = await tx.task.create({
      data: {
        title: parsedBody.data.title,
        amount: 1*totalDecimal,
        signature: parsedBody.data.signature,
        user_id: userId,
      },
    });
    await tx.option.createMany({
      data: parsedBody.data.options.map((option) => ({
        image_url: option.imageUrl,
        task_id: response.id,
      })),
    });
    return response;
  });
  res.json({
        id:response.id
  })

});

export default router;
