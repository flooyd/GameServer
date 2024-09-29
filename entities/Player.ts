import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
//import uuid as v4 from "uuid/v4";
import { v4 as uuidv4 } from "uuid";
type Uuid = string;

@Entity()
export class Player {
  @PrimaryGeneratedColumn("uuid")
  id: Uuid = uuidv4();

  @Column({ type: "varchar", length: 255, unique: true })
  name: string = "Player";

  @Column({ type: "float" })
  x: number = 0;

  @Column({ type: "float" })
  y: number = 0;

  @Column({ type: "float" })
  width: number = 30;

  @Column({ type: "float" })
  height: number = 30;

  @Column({ type: "varchar", length: 255 })
  password: string = "password";

  @Column({ type: "varchar", length: 255, nullable: true })
  email: string = "email";

  //area string nullable
  @Column({ type: "varchar", length: 255, nullable: true })
  area: string = "The Beginning";

  //color string nullable
  @Column({ type: "varchar", length: 255, nullable: true })
  color: string = "#000000";
}
