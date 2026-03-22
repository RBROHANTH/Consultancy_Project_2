import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const users = [
    {id:"1",name:"Rohanth",age: 19 , isMarried: false},
    {id:"2",name:"Rohit",age: 20 , isMarried: true},
    {id:"3",name:"Rithik",age: 20 , isMarried: false}
]

const typeDefs = `
    type Query {
        getUsers : [User]
        getUserByID(id: ID): User 
    }

    type Mutation {
        createUser(name:String!,age : Int!,isMarried:Boolean!):User
    }

    type User {
        id:ID
        name:String
        age:Int
        isMarried: Boolean
    }

`;

 const resolvers = {
    Query:{
        getUsers:() => {
            return users;
        },
        getUserByID: (parent, args) => {
            const id = args.id;
            return users.find((user) => user.id === id);
        },
    },
    Mutation: {
        createUser: (parent,args) => {
            const {name,age,isMarried} = args;
            const newUser = {
                id:(users.length+1).toString(),
                name,
                age,
                isMarried,
            };
            users.push(newUser);
            return newUser
        },




    },

 };


const server = new ApolloServer({typeDefs,resolvers});

const {url} = await startStandaloneServer(server,{
    listen:{port: 4000},
});
    console.log(`Server Running at : ${url}`);