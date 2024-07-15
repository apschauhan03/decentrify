import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import jwt from "jsonwebtoken";
import { authMiddleWare } from "../middleware";
const router = Router();




const prismaClient = new PrismaClient();
const s3Client = new S3Client({
    credentials:{
        accessKeyId: process.env.Access_Key_Id as string,
        secretAccessKey: process.env.Secret_Access_Key as string
    },
    region:'us-east-1'
});

//sign in with router
router.post("/signin",async(req,res)=>{

    //add signature verification logic here


    // authentication
    const walletAddress = "flkadsfklasjfkasjdflkasdjfla";
    const existingUser = await prismaClient.user.findFirst({
        where:{
            walletAddress:walletAddress
        }
    })
    const JWTSecret = process.env.JWTSecret as string;

    if(existingUser)
    {
        const token = jwt.sign({
            userId:existingUser.id
        },JWTSecret);

        res.json({token});
    }
    else
    {
        const user = await prismaClient.user.create({
            data:{
                walletAddress:walletAddress
            }
        });

        const token = jwt.sign({
            userId:user.id
        },JWTSecret);
        res.json({token});
    }
});


router.get("/generatepresignedurl",authMiddleWare,async (req,res)=>{
    // @ts-ignore
    const userId = req.userId;
    const key = `content/${userId}/${Math.random()}/image.jpg`;
    const command = new PutObjectCommand({
        Bucket: "decentrify-object-store",
        Key: key,
        // ContentType: "image/jpeg"
    });
      
      const preSignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 360
      })

    console.log('====================================');
    console.log(preSignedUrl);
    console.log('====================================');

    res.json({
        preSignedUrl
    })
})



export default router;