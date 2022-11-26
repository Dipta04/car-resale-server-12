const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z5wnfjm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
   const authHeader = req.headers.authorization;
   if (!authHeader) {
      return res.status(401).send('unauthorized access');
   }

   const token = authHeader.split(' ')[1];

   jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
      if (err) {
         return res.status(403).send({ message: 'forbidden access' })
      }
      req.decoded = decoded;
      next();
   })

}

async function run() {
   try {
      const carCollection = client.db('carResale').collection('carOptions');
      const singleCarCollection = client.db('carResale').collection('cars');
      const usersCollection = client.db('carResale').collection('users');
      const bookingsCollection = client.db('carResale').collection('bookings');
      const addProductCollection = client.db('carResale').collection('products');
      const paymentsCollection = client.db('carResale').collection('payments');
      const advertiseCollection = client.db('carResale').collection('advertise');


      const verifyAdmin = async (req, res, next) => {
         const decodedEmail = req.decoded.email;
         const query = { email: decodedEmail };
         const user = await usersCollection.findOne(query);

         if (user?.role !== 'admin') {
            return res.status(403).send({ message: 'forbidden access' })
         }
         next();
      }

      app.get('/jwt', async (req, res) => {
         const email = req.query.email;
         const query = { email: email };
         const user = await usersCollection.findOne(query);
         if (user) {
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' })
            return res.send({ accessToken: token });
         }
         res.status(403).send({ accessToken: '' })
      });

      app.post('/jwt', (req, res) => {
         const user = req.body;
         const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '7d' })
         res.send({ token })
      })


      //  user
      app.get('/users', async (req, res) => {
         const query = {};
         const users = await usersCollection.find(query).toArray();
         res.send(users);
      })

      app.get('/users/admin/:email', async (req, res) => {
         const email = req.params.email;
         const query = { email }
         const user = await usersCollection.findOne(query);
         res.send({ isAdmin: user?.role === 'admin' });
      })

      app.post('/users', async (req, res) => {
         const user = req.body;
         console.log(user);
         const result = await usersCollection.insertOne(user);
         res.send(result);
      });

      app.put('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {

         const id = req.params.id;
         const filter = { _id: ObjectId(id) }
         const options = { upsert: true };
         const updatedDoc = {
            $set: {
               role: 'admin'
            }
         }
         const result = await usersCollection.updateOne(filter, updatedDoc, options);
         res.send(result);
      });

      app.delete('/users/:id', async (req, res) => {
         const id = req.params.id;
         const filter = { _id: ObjectId(id) };
         const result = await usersCollection.deleteOne(filter);
         res.send(result);
      })


      // car
      app.get('/carOptions', async (req, res) => {
         const query = {};
         const cursor = carCollection.find(query);
         const cars = await cursor.toArray();
         res.send(cars);
      })

      app.get('/carOptions/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const collection = await carCollection.findOne(query);
         res.send(collection);
      })

      app.get('/cars', async (req, res) => {
         const query = {};
         const cursor = singleCarCollection.find(query);
         const cars = await cursor.toArray();
         res.send(cars);
      })

      app.get('/cars/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const singleCar = await singleCarCollection.findOne(query);
         res.send(singleCar);
      })

      //   booking
      app.get('/bookings', verifyJWT, async (req, res) => {
         const email = req.query.email;
         const decodedEmail = req.decoded.email;

         // if (email !== decodedEmail) {
         //    return res.status(403).send({ message: 'forbidden access' });
         // }
         const query = { email: email };
         const bookings = await bookingsCollection.find(query).toArray();
         res.send(bookings);
      })

      app.get('/bookings/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const booking = await bookingsCollection.findOne(query);
         res.send(booking);
      })

      app.post('/bookings', async (req, res) => {
         const booking = req.body;
         const result = await bookingsCollection.insertOne(booking);
         res.send(result);
      })

      // seller add a product

      app.get('/products', verifyJWT, async (req, res) => {
         const email = req.query.email;
         const decodedEmail = req.decoded.email;

         // if (email !== decodedEmail) {
         //    return res.status(403).send({ message: 'forbidden access' });
         // }
         const query = { email: email };
         const products = await addProductCollection.find(query).toArray();
         res.send(products);
      })

      app.post('/products', async (req, res) => {
         const product = req.body;
         const result = await addProductCollection.insertOne(product);
         res.send(result);
      })

      app.delete('/products/:id', async (req, res) => {
         const id = req.params.id;
         const filter = { _id: ObjectId(id) };
         const result = await addProductCollection.deleteOne(filter);
         res.send(result);
      })

      app.get('/users/seller/:email', async (req, res) => {
         const email = req.params.email;
         const query = { email }
         const user = await usersCollection.findOne(query);
         res.send({ isSeller: user?.role === 'seller' });
      })
       
      // payment
      app.post('/create-payment-intent', async (req, res) => {
         const booking = req.body;
         const price = booking.price;
         const amount = price * 100;

         const paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: amount,
            "payment_method_types": [
               "card"
            ]
         });
         res.send({
            clientSecret: paymentIntent.client_secret,
         });
      })

      app.post('/payments', async (req, res) => {
         const payment = req.body;
         const result = await paymentsCollection.insertOne(payment);
         const id = payment.bookingId
         const filter = { _id: ObjectId(id) }
         const updatedDoc = {
            $set: {
               paid: true,
               transactionId: payment.transactionId
            }
         }
         const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
         res.send(result);
      })

      
      // advertise

      app.get('/products/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: ObjectId(id) };
         const advertise = await addProductCollection.findOne(query);
         res.send(advertise);
      })


      app.put('/products/advertise/:id', async(req,res)=>{
         const id = req.params.id;
         const filter = { _id: ObjectId(id) }
         const options = { upsert: true };
         const updatedDoc = {
            $set: {
               advertise: 'advertise'
            }
         }
         const result = await addProductCollection.updateOne(filter, updatedDoc, options);
         res.send(result);
      })

   }
   finally {

   }
}
run().catch(console.log);



app.get('/', (req, res) => {
   res.send('Car resale server is running')
})

app.listen(port, () => {
   console.log(`Car resale server is running on ${port}`)
})