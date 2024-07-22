import { PrismaClient } from "@prisma/client";

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
            title:true,
            options:true
        }
    });
    return task;
}
