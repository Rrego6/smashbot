import { AllowNull, Column, Model, Table, Unique } from 'sequelize-typescript';

@Table
export class Guild extends Model {

    @Unique
    @AllowNull(false)
    @Column
    guild_id: string;

    @Unique
    @AllowNull(true)
    @Column
    bot_info_channel_id: string;

    @Unique
    @AllowNull(true)
    @Column
    pinned_channel_id: string;


    @AllowNull(true)
    @Column
    pinned_message_id: string;
}