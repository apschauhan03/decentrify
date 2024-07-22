import z from 'zod';


export const createTaskInput = z.object({
    options: z.array(z.object({
        imageUrl:z.string()
    })),
    title: z.string(),
    signature:z.string()
})


export const createSubmissionInput = z.object({
    taskId:z.string(),
    selection:z.string()
})