import 'reflect-metadata';
import { Server } from 'socket.io';
import { createConnection, getRepository } from 'typeorm';
import * as dotenv from 'dotenv';
import { Player as PlayerEntity } from './entities/Player'
import { Todo as TodoEntity } from './entities/Todo'
import bcrypt from 'bcrypt';
dotenv.config();

const {
  DB_HOST = 'localhost',
  DB_PORT = 5432,
  DB_USERNAME,
  DB_PASSWORD,
  DB_NAME,
  PORT = 3000,
} = process.env;

if (!DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
  console.error(
    "Missing required environment variables: DB_USERNAME, DB_PASSWORD, DB_NAME"
  );
  process.exit(1);
}

const io = new Server(3000, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'], // Allow specific HTTP methods
  }
});

type Player = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

type Todo = {
  id: string;
  author: string;
  done: boolean;
  task: string;
  description: string;
  x: number;
  y: number;
}

let players: Player[] = [];

createConnection({
  type: "postgres",
  host: DB_HOST,
  port: parseInt(DB_PORT.toString()),
  username: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_NAME,
  entities: [PlayerEntity, TodoEntity],
  synchronize: true,
  logging: false,
}).then(async () => {
  console.log('Connected to database');
  const playerRepository = getRepository(PlayerEntity);
  io.on('connection', (socket) => {
    console.log('An anonymous user connected');

    socket.on('Register', async (name: string, password: string, email: string) => {
      let player = await register(name, password, email);
      if (player) {
        socket.emit('Registered');
      } else {
        socket.emit('RegistrationFailed');
      }
    });

    socket.on('Login', async (name: string, password: string) => {
      let player = await login(name, password);
      if (player) {
        socket.emit('LoginSuccess', player);
        socket.emit('ExistingPlayers', players);
        players.push(player);
        socket.broadcast.emit('OtherPlayerConnected', player);
        socket.on('PlayerMove', player => {
          const updatedPlayer = players.find(p => p.id === player.id.toString());
          if (!updatedPlayer) {
            return;
          }
          updatedPlayer.x = player.x;
          updatedPlayer.y = player.y;
          socket.broadcast.emit('OtherPlayerMove', player);
        });

        socket.on('disconnect', () => {
          players = players.filter((p) => p.id !== player.id);
          savePlayer(player);
          socket.broadcast.emit('OtherPlayerDisconnected', player.id);
        });

        //create todo. look up the author by player id
        socket.on('CreateTodo', async (task: string, x: number, y: number, id: string) => {
          let author = players.find(p => p.id === id);
          if (author) {
            let newTodo = new TodoEntity();
            newTodo.author = author.name;
            newTodo.task = task;
            newTodo.x = x;
            newTodo.y = y;
            let createdTodo = await getRepository(TodoEntity).save(newTodo);
            socket.emit('TodoCreated', createdTodo);
            socket.broadcast.emit('TodoCreated', createdTodo);
          } else {
            socket.emit('TodoCreationFailed');
          }
        });

        socket.on('EditTodo', async (id: string, task: string, x: number, y: number, player_id) => {
          let todo = await getRepository(TodoEntity).findOne({ where: { id: id } });
          if (todo && todo.author === players.find(p => p.id === player_id)?.name) {
            todo.task = task;
            todo.x = x;
            todo.y = y;
            let updatedTodo = await getRepository(TodoEntity).save(todo);
            socket.emit('TodoEdited', updatedTodo);
            socket.broadcast.emit('TodoEdited', updatedTodo);
          } else {
            socket.emit('TodoEditFailed');
          }
        });

        socket.on('ToggleTodo', async (id: string, player_id) => {
          let todo = await getRepository(TodoEntity).findOne({ where: { id: id } });
          if (todo && todo.author === players.find(p => p.id === player_id)?.name) {
            todo.done = !todo.done;
            let updatedTodo = await getRepository(TodoEntity).save(todo);
            socket.emit('TodoToggled', updatedTodo);
            socket.broadcast.emit('TodoToggled', updatedTodo);
          } else {
            socket.emit('TodoToggleFailed');
          }
        });

        socket.on('MoveTodo', async (id: string, x: number, y: number, player_id) => {
          let todo = await getRepository(TodoEntity).findOne({ where: { id: id } });
          if (todo && todo.author === players.find(p => p.id === player_id)?.name) {
            todo.x = x;
            todo.y = y;
            let updatedTodo = await getRepository(TodoEntity).save(todo);
            socket.emit('TodoMoved', updatedTodo);
            socket.broadcast.emit('TodoMoved', updatedTodo);
          } else {
            socket.emit('TodoMoveFailed');
          }
        });

        socket.on('DeleteTodo', async (id: string, player_id) => {
          let todo = await getRepository(TodoEntity).findOne({ where: { id: id } });
          if (todo && todo.author === players.find(p => p.id === player_id)?.name) {
            await getRepository(TodoEntity).delete(id);
            socket.emit('TodoDeleted', id);
            socket.broadcast.emit('TodoDeleted', id);
          } else {
            socket.emit('TodoDeletionFailed');
          }
        });

        socket.on('GetTodos', async () => {
          let todos = await getRepository(TodoEntity).find();
          socket.emit('Todos', todos);
        })
      } else {
        socket.emit('LoginFailed');
      }
    });
  });
});

const savePlayer = async (player: Player) => {
  await getRepository(PlayerEntity).save(player);
}

const register = async (name: string, password: string, email: string) => {
  let newPlayer = new PlayerEntity();
  newPlayer.name = name.toLocaleLowerCase();
  newPlayer.password = await hashPassword(password); // Hash the password
  newPlayer.email = email;

  let foundPlayer = await getRepository(PlayerEntity).findOne({ where: { name: newPlayer.name } });
  if (!foundPlayer) {
    let createdPlayer = await getRepository(PlayerEntity).save(newPlayer);
    return playerSafeView(createdPlayer);
  } else {
    return null;
  }
}

const login = async (name: string, password: string) => {
  let foundPlayer = await getRepository(PlayerEntity).findOne({ where: { name: name } });
  if (foundPlayer && await bcrypt.compare(password, foundPlayer.password)) { // Compare hashed password
    return playerView(foundPlayer);
  } else {
    return null;
  }
}

const hashPassword = async (password: string) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

const playerSafeView = (player: PlayerEntity) => {
  return {
    name: player.name,
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  }
}

const playerView = (player: PlayerEntity) => {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  }
}