import "./App.css";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react"; // v4 needs this

const Get_Users = gql`
  query getUsers{
  getUsers {
    id
    name
    age
    isMarried
  }
}
`;

function App() {
const {data,error,loading} = useQuery(Get_Users);

  if(loading) return <p>Data Loading.....</p>;

  if(error) return <p>Error: {error.message}</p>;
  return <><h1>
    Users
    </h1>
    <div>
      {data.getUsers.map((user) => (
      <div>
        <p>Name : {user.name}</p>
        <p>Age : {user.age}</p>
        <p>Is this user Married : {user.isMarried ? "YES" : "NO"}</p>
      </div>
    ))}
    </div>
    </>
}

export default App;