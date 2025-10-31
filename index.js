import express from 'express';
import pg from "pg";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";

const app = express();
const port = 3000;
const upload = multer({ dest: "uploads/" });
dotenv.config();

const DEFAULT_SLOTS = ["07:00 am", "09:00 am", "11:00 am", "01:00 pm"];
const MAX_SLOTS = 5

app.use(cors({
  origin: "https://avigithubb.github.io", 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));

const db = new pg.Client({
    connectionString: process.env.POSTGRES_URI,
    ssl: { rejectUnauthorized: false }
});

// const db = new pg.Client({
//     user: "postgres",
//     password: "Postors",
//     host: "localhost",
//     database: "highway_delite",
//     port: 5432
// });

db.connect();


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/experiences', async(req, res) => {
    const experiences = await db.query('SELECT * FROM listing_data');
    const data = experiences.rows.map(row => ({
        ...row,
        img: row.img ? row.img.toString('base64') : null
    }));
    return res.json(data);
});

app.get('/experiences/:destination', async(req, res) => {
    const destination = req.params.destination;
    console.log(destination)
    const experience = await db.query('SELECT * FROM listing_data WHERE destination = $1', [destination]);
    const data = experience.rows.map(row => ({
        ...row,
        img: row.img ? row.img.toString('base64') : null
    }));
    return res.json(data);
});

app.get("/slots/:date", async(req, res)=>{
    const {date} = req.params;
    console.log(date);
    var available1 = 5;
    var available2 = 5;
    var available3 = 5;
    var available4 = 5;

    const result1 = await db.query("SELECT * FROM bookings WHERE date = $1 and time = $2", [date, DEFAULT_SLOTS[0]]);
    const result2 = await db.query("SELECT * FROM bookings WHERE date = $1 and time = $2", [date, DEFAULT_SLOTS[1]]);
    const result3 = await db.query("SELECT * FROM bookings WHERE date = $1 and time = $2", [date, DEFAULT_SLOTS[2]]);
    const result4 = await db.query("SELECT * FROM bookings WHERE date = $1 and time = $2", [date, DEFAULT_SLOTS[3]]);

    if(result1 != null){
        available1 = MAX_SLOTS - result1.rows.length;
    }
    
    if(result2 != null){
        available2 = MAX_SLOTS - result2.rows.length;
    }

    if(result3 != null){
        available3 = MAX_SLOTS - result3.rows.length;
    }

    if(result4 != null){
        available4 = MAX_SLOTS - result4.rows.length;
    }

    const dict = {"07:00 am": available1, "09:00 am": available2, "11:00 am": available3, "01:00 pm": available4}

    return res.json(dict);

})

app.post('/bookings', async(req, res) => {
    try{
        const {name, email, destination, date, price, time, month} = req.body;
        console.log(name, email, destination, date, price, time, month);

        console.log("I'm in");
        
        const record_exist = await db.query("SELECT * FROM bookings WHERE name = $1 AND email = $2 AND destination = $3 AND date = $4 AND time = $5 AND month = $6", [name, email, destination, date, time, month]);
        if(record_exist.rows.length != 0){
            console.log("psssstt");
            return res.json({"message": "failure", "error": "booking already exist"});
        }

        const all_date_booking = await db.query("SELECT * FROM bookings WHERE date = $1 AND time = $2", [date, time])
        var all_count = 0;
        if(all_date_booking.rows.length != 0){
            console.log("how!");
            all_count = all_date_booking.rows.length;
        }
        if(all_count >= MAX_SLOTS){
            console.log("impossible");
            return res.json({"message": "failure", "error": "Sold out"});
        }
        console.log("hooray");
        await db.query('INSERT INTO bookings (name, email, date, price, destination, time, month) VALUES($1, $2, $3, $4, $5, $6, $7)', [name, email, date, price, destination, time, month]);
        return res.json({"message": "success"});
    }
    catch(e){
        console.log("Nop, I'm here");
        return res.json({"message": "failure"});
    }
});

app.post('/promo/validate', async(req, res) => {
    const promo_code = req.query.code;
    const response = await db.query('SELECT * FROM promo WHERE code = $1', [promo_code]);
    if(response != null){
        return res.json({"message": "success", "discount": response.discount});
    }
    else{
        return res.json({"message": "failure"});
    }
});

app.post("/upload-experience", async (req, res)=>{
    try {
        const { img, destination, location, price } = req.body;
        console.log(destination, location, price)
        const base64Data = img.split(",")[1];
        const imgBuffer = Buffer.from(base64Data, "base64");

        await db.query("INSERT INTO listing_data (img, destination, location, price) VALUES ($1, $2, $3, $4)",
        [imgBuffer, destination, location, price]);

        res.json({ message: "Uploaded successfully" });
    } 
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
})

app.listen(port, () => {
    console.log(`Server is running at port ${port}`);
});