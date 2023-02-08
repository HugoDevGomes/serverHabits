import Fastify from 'fastify'
import cors from '@fastify/cors'
import { appRoutes } from './routes'
import jwt from '@fastify/jwt'

const idSecret = process.env.SECRET;

async function bootstrap() {

    const app = Fastify()

   await app.register(cors, {
    origin:true
   })

   await app.register(jwt, {
    secret: `${idSecret}`,
   })

    app.register(appRoutes)


    await app.listen({
        port: 443, host: '0.0.0.0'
    })

    
}

bootstrap()