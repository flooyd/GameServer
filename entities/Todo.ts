import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
//import uuid as v4 from "uuid/v4";
import { v4 as uuidv4 } from "uuid";
type Uuid = string;

@Entity()
export class Todo {
  @PrimaryGeneratedColumn("uuid")
  id: Uuid = uuidv4();

  @Column({ type: "varchar", length: 255})
  author: string = "Player";

  //boolean to check if the task is done
  @Column({ type: "bool" })
  done: boolean = false;

  @Column({ type: "varchar", length: 255 })
  task: string = "task";

  //x
  @Column({ type: "float" })
  x: number = 0;

  //y
  @Column({ type: "float" })
  y: number = 0;
}
