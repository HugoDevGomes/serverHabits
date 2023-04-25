import Fastify from 'fastify'
import cors from '@fastify/cors'
import { appRoutes } from './routes'
import jwt from '@fastify/jwt'

const idSecret = process.env.SECRET;
const portNumber = Number(process.env.PORT);

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
        port:  portNumber || 8080 ,
      })
 // teste git
    
}

bootstrap()
