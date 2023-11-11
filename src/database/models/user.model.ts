import { AllowNull, BeforeCreate, BeforeUpdate, BelongsTo, Column, DataType, ForeignKey, Model, Table, Unique } from 'sequelize-typescript';
import { GuildModel } from '../index.js';

@Table
export class User extends Model {

    @AllowNull(false)
    @Column
    discord_member_id: string;

    @ForeignKey(() => GuildModel)
    @AllowNull(false)
    @Column
    guild_fk: string;

    @BelongsTo(() => GuildModel)
    guild: GuildModel

    @AllowNull(true)
    @Column
    slippi_tag: string;


    @AllowNull(true)
    @Column(DataType.JSON)
    main_characters: string[];

}