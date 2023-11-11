
import { Sequelize } from 'sequelize-typescript';

import { Guild } from './models/guild.model.js'
import { User } from './models/user.model.js'

const db = new Sequelize({
    database: 'db',
    dialect: 'sqlite',
    username: 'root',
    storage: 'sqllite',
    models: [Guild, User],
})


export {
    Guild as GuildModel, User as UserModel, db
}