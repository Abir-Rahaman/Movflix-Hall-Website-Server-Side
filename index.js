const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")('sk_test_51L18qLA4o5tgtQUC1uB9NDMgtflOI0Iggy0Nwf1DJo1PHjRMQ3gqBGfzAeOHh0M3aYXGGOOBjgIePEGBOHB9qSS200sMrmtmAU');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@movflix.le7dwpw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
  const authHeaders = req.headers.authorization;
  console.log(authHeaders);
  if (!authHeaders) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
  const token = authHeaders.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access " });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
  
    const movieCollection = client.db("CinemaHall").collection("Movies");
    const bookingCollection = client.db("CinemaHall").collection("Bookings");
    const googleUsersCollection = client.db("CinemaHall").collection("googleUsers");
    const MovieServer = client.db("CinemaHall").collection("New Movies");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const reqAccount = await googleUsersCollection.findOne({ email: requester });
      if (reqAccount.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "Forbidden Access " });
      }
    };

    // get all movies in the collection
    app.get("/movie", async (req, res) => {
      const query = {};
      const cursor = movieCollection.find(query);
      const movie = await cursor.toArray();
      res.send(movie);
    });

    // upload new movie in cart
    app.post("/movie", async (req, res) => {
      const newMovie = req.body;
      const movie = movieCollection.insertOne(newMovie);
      res.send(movie);
    });

    // post bookings to the booking collection
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      return res.send(result);
    });

    // get all bookings
    app.get("/bookings", async (req, res) => {
      const email = req.query.email;
        const query = { email: email };
        const bookings = await bookingCollection.find(query).toArray();
        res.send(bookings);

    });

    // get all users
    app.get("/user", async (req, res) => {
      const users = await googleUsersCollection.find().toArray();
      res.send(users);
    });

    // delete admin by id
    app.delete("/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await googleUsersCollection.deleteOne(filter);
      res.send(result);
    });

    // save all users from google accounts
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await googleUsersCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "3h" });

      res.send({ result, token });
    });

    // make admin api
    app.put("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await googleUsersCollection.updateOne(filter, updateDoc);
      res.send({ result });
    });

    //  get all admin users
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await googleUsersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });


    // payment system integration
    app.post('/create-payment-intent', async(req,res) =>{
      const order = req.body;
      const price = order.price;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
       amount:amount,
       currency : 'usd',
       payment_method_types:['card']
      })
      res.send({clientSecret : paymentIntent.client_secret})
   })
    
    // add movie using react hook form form control and save to database
    app.post("/booking", async (req, res) => {
      const movie = req.body;
      const query = { MovieName: movie.MovieName };
      const exists = await MovieServer.findOne(query);
      if (exists) {
        return res.send({ success: false, movie: exists });
      }
      const result = await MovieServer.insertOne(movie);
      return res.send({ success: true, result });
    });

    // get all new movies from the database
    app.get("movies", async (req, res) => {
      const movies = await MovieServer.find().toArray();
      res.send(movies);
    });

    // get id for payment system
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await movieCollection.findOne(query);
      res.send(booking);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Movflix World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
