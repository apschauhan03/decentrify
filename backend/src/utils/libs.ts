import { PrismaClient } from "@prisma/client";

export const totalDecimal = 1_00_0000;
const prismaClient = new PrismaClient();

export const getNextTask = async (userId:string)=>{
    const task = await prismaClient.task.findFirst({
        where:{
            done:false,
            submissions:{
                none:{
                    worker_id:Number(userId),
                }
            }
        },
        select:{
            id:true,
            title:true,
            options:true,
            amount:true
        }
    });
    return task;
}
