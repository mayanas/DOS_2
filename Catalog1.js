const express = require('express');
const bodyParser = require('body-parser');
//npm library used to interact with file system
const fs = require("fs");
//since our database is in a CSV file, needed this npm library to interact with it
const csv = require('fast-csv');
//needed in order to write the updated data when purchsing
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const axios = require('axios');

const app = express();

const port = 3001;


app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());



//search by topic get request with topic passed in the request body
app.get("/search", (req, res) => {
    console.log('replica1');
    let query = req.body.topic;
    console.log(query)
    const data = []
    let flag = 0;
    //same idea of the previous request 
    fs.createReadStream('DB.CSV')
        .pipe(csv.parse({ headers: true }))
        .on('error', error => res.send("Somthing wrong occurred!"))
        .on('data', (row) => {
            if (row.Topic == query) {
                flag = 1;
                data.push({ "Name": row.Name, "ID": row.ID });
            }
        })
        .on('end', () => {
            if (flag == 1) res.send(data);
            else if (flag == 0) res.send("No books found related to this topic")
        }
        );


})

//get information of book by sending its number as parameter in the url
app.get("/info/:item_number", (req, res) => {
    //get the parameter value
    let query = req.params.item_number;
    let data = "";//to get the book info
    let flag = 0;
    //read file
    fs.createReadStream('DB.CSV')
        .pipe(csv.parse({ headers: true }))//avoid the first line
        .on('error', error => {//error with file system
            console.error("Somthing wrong occurred!");
            res.send("Somthing wrong occurred!");
        })
        .on('data', (row) => {//read data line by line from the file
            if (row.ID == query) {
                //if the book found
                flag = 1;
                data = { "Name": row.Name, "Topic": row.Topic, "NumItem": row.NumItem, "Cost": row.Cost };//get the book info and store it in data
            }
        })

        .on('end', () => {//in the end of the file send the result, if the book found or not
            if (flag == 0) res.send("Book does not exist, make sure to enter valid item number");
            else res.send(data);
        }
        );


})

//get information of book by sending its number in the request body
app.get("/info", (req, res) => {
    //the only difference from the previous one is how to get the value of item_number 
    //get it from the request body
    let query = req.body.item_number;
    let data = ""
    fs.createReadStream('DB.CSV')
        .pipe(csv.parse({ headers: true }))
        .on('error', error => {
            console.log("Somthing wrong occurred!")
            res.send("Somthing wrong occurred!")
        })
        .on('data', (row) => {
            if (row.ID == query) {
                data = { "Name": row.Name, "Topic": row.Topic, "NumItem": row.NumItem, "Cost": row.Cost };
            }
        })

        .on('end', () => {
            res.send(data);
        }
        );


})

//this request used by the purchase service
//to check if the item with item_number sent in the uri exist and is not out of stock
app.get("/numStock/:item_number", (req, res) => {
    //get the item number from the parameter
    let query = req.params.item_number;
    let data = "";//the returned result 
    //open the file (database) and avooid the 1st line its header
    fs.createReadStream('DB.CSV')
        .pipe(csv.parse({ headers: true }))
        .on('error', error => console.error(error))//if errors occurred with file system
        .on('data', (row) => {
            if (row.ID == query) {//if the item found get its data
                data = row;
            }
        })

        .on('end', () => {
            if (data == "") {
                //if item number not found -> no book with this number
                console.log("Item not found!")
                res.send("Item not found!");
            }
            else if (data.NumItem == "0") {
                //there is a book, we want to check if it is out of stock or not
                console.log("Item Out of stock!")
                res.send("Item Out of stock!");
            }
            else {
                res.send(data);//send the whole data if the book is in stock
            }
        }
        );


})

//update request used from the order server when the book is found and it is in stock then purchase it and decrement its number of stck by one
app.put("/update", (req, res) => {
    //used for writing in the csv file with the update of # of items in stock
    const csvWriter = createCsvWriter({
        path: 'DB.CSV',
        //the header (first line) in the csv file
        header: [
            { id: 'ID', title: 'ID' },
            { id: 'Topic', title: 'Topic' },
            { id: 'Name', title: 'Name' },
            { id: 'NumItem', title: 'NumItem' },
            { id: 'Cost', title: 'Cost' },

        ],
        append: false
    });
    let query = req.body;//get the info of the book needed to be purchases
    const data = [];//store books from the database with the updated book

    //start reading the file database
    fs.createReadStream('DB.CSV')
        .pipe(csv.parse({ headers: true }))
        .on('error', error => console.error(error))
        .on('data', (row) => {
            if (row.ID == query.ID) {
                //if this is the book push the query which is handling the book info with the new modifications
                data.push(query);
            }
            //push the row not updated at it is
            else data.push(row);
        })
        .on('end', () => {
            //overwrite back the data in the file with the modifications
            csvWriter.writeRecords(data)

            axios
                .put('http://192.168.1.106:3000' + '/invalidateRequest', {
                    ID: query.ID,
                    Topic: query.Topic,
                })
                .then(resu => {
                })
                .catch(error => {
                    res.send("Something went wrong")
                });

            res.send("done")
        }
        );


})
app.listen(port, () => console.log("Catalog service is running on port " + port));