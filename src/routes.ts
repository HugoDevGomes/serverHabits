import dayjs from "dayjs"
import { FastifyInstance } from "fastify"
import { object, z } from 'zod'
import { prisma } from "./lib/prisma"
import { authenticate } from "./plugins/authentication"


export async function appRoutes(app: FastifyInstance){

    // me

    app.get('/me', {
            onRequest: [authenticate]
        }, async( request ) =>{
        return {user: request.user}
    })

    // Autenticação

    
    app.post('/users',  async (request) =>{
        const createUserBody = z.object({
            access_token: z.string(),
        })
        
        const { access_token} = createUserBody.parse(request.body)

        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            method: 'GET',
            headers: {
                Authorization : `Bearer ${access_token} `
                }
            })

        const userData = await userResponse.json()

        const userInfoSchema = z.object({
            id: z.string(),
            email: z.string().email(),
            name: z.string(),
            picture: z.string().url()
        })

        const userInfo = userInfoSchema.parse(userData)

        let user = await prisma.user.findUnique({
            where: {
                googleId: userInfo.id
            }
        })

        if (!user) {
            user = await prisma.user.create({
                data: {
                    googleId: userInfo.id,
                    name: userInfo.name,
                    email: userInfo.email,
                    avatarUrl: userInfo.picture

                }
            })
        }

        const token = app.jwt.sign({
            name: user.name,
            avatarUrl: user.avatarUrl
        }, {
             sub: user.id,
             expiresIn: '1 days'
        })

        return { token }

        })

    // Outras rotas

    app.post('/habits',  async (request, reply) =>{
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(z.number().min(0).max(6))

        })

        const { title, weekDays } = createHabitBody.parse(request.body)

        const today = dayjs().startOf('day').toDate()

        try {
            await request.jwtVerify()
        

        await prisma.habit.create({
        data: {
            title,
            created_at: today,
            userId: request.user.sub,
            weekDays: {
                create: weekDays.map(weekDay =>{
                    return {
                        week_day: weekDay,
                    }
                })
            }
        }
       })
    } catch {
        return console.log("Usuário logado!")
    }
    })

    app.get('/day', async (request) =>{
        const getDayParams = z.object({
            date: z.coerce.date()
        })

        const { date } = getDayParams.parse(request.query)
        const parsedDate = dayjs(date).startOf('day')

        const weekDay = parsedDate.get('day')

        try {

            await request.jwtVerify()

            const possibleHabits = await prisma.habit.findMany({
                where: {
                    userId:{
                        equals: request.user.sub
                    },
                    created_at: {
                        lte: date,
                    },
                    weekDays: {
                        some: {
                            week_day: weekDay,
                        }
                    }

                }
            })

            const completedHabits2 = await prisma.$queryRaw`
            SELECT 
            HI.id as Habit_Id
            FROM days D
            JOIN day_habits DA
            ON D.id = DA.day_id
            JOIN habits HI 
            ON DA.habit_id = HI.id
            WHERE
            D.date = (${parsedDate.toDate()}) 
            AND HI.userId = (${request.user.sub})
        `

            const day = await prisma.day.findUnique({
                    
                where: {
                    date: parsedDate.toDate()
                },
                include: {
                    dayHabits: true,
                }
            })

            const completedHabits = completedHabits2?.map( u=> {
                return u.Habit_Id
            })


             // const completedHabits = day?.dayHabits.map(dayHabit => {
             //   return dayHabit.habit_id
            // })

            return {
                possibleHabits,
                completedHabits2
            }
        } catch (error) {
            return {
                error
            }
        }
    })


    app.patch('/habits/:id/toggle', async (request) => {
        const toogleHabitParams = z.object({
            id: z.string().uuid(),
        })

        const { id } = toogleHabitParams.parse(request.params)

        const today = dayjs().startOf('day').toDate()

        let day = await prisma.day.findUnique({
            where: {
                date: today
            }
        })

        if (!day) {
            day = await prisma.day.create({
                data:{
                    date: today,
                }
            })
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where:{
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id,
                }
            }
        })

        if (dayHabit) {
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id
                }
            })
        } else {
            await prisma.dayHabit.create({
                data:{
                    day_id: day.id,
                    habit_id: id
                }
            })
        }
    })
    

    app.get('/summary', async(request) =>{
        try {
            await request.jwtVerify()
            
            const summary = await prisma.$queryRaw`
            SELECT DISTINCT
        D.id, 
        D.date,
        (
          SELECT 
            cast(count(*) as float)
          FROM day_habits DH
          JOIN habits HAB 
          ON DH.habit_id = HAB.id
          WHERE 
          HAB.userId = (${request.user.sub}) AND
          DH.day_id = D.id
        ) as completed,
        (
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HDW
          JOIN habits H
            ON H.id = HDW.habit_id
          WHERE
            H.userId = (${request.user.sub}) AND
            HDW.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.created_at <= D.date
        ) as amount
      FROM days D
      JOIN day_habits DA
      ON D.id = DA.day_id
      JOIN habits HI 
      ON DA.habit_id = HI.id
      WHERE
      HI.userId = (${request.user.sub})
    `

            return summary
        } catch (error) {
            return{
                error
            }
            }
    })
}
