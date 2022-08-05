const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require("fs");
const json2csv = require("json2csv").parse;

const app = express();
const port = 3003;

//ip address & port of catalog service 
let catalog = ['192.168.1.109', '3001', 0, '192.168.1.109', '3002', 0];

let chosen_replica = 0;//0->replica1, 3->replica2

let ip_order2='192.168.1.109';
let port_order2='3004';

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(bodyParser.json());

//purchase request to buy the book with number passed in the request body
app.post("/purchase", (req, res) => {
  let item_number = req.body.item_number;
  let amount = req.body.amount;//amount of decrementing

  catalog[2] = req.body.catalog1;
  catalog[5] = req.body.catalog2;

  if (catalog[2] < catalog[5]) {
    catalog[2]++;
    chosen_replica = 0;
  } else {
    catalog[5]++;
    chosen_replica = 3;
  }

  //axios request sent to catalog server inorder to check if the book is found and in stock
  axios
    .get('http://' + catalog[chosen_replica] + ':' + catalog[chosen_replica + 1] + '/numStock/' + item_number)
    .then(async resw => {
      //show the results if not found or out of stock
      if (resw.data == "Item not found!" || resw.data == "Item Out of stock!") {

        console.log(resw.data);
        res.send(resw.data);
      }
      else {
        //if book found and in stock
        //add the order to the orderdb in file OrderDB.CSV
        var newLine = '\r\n';

        var fields = ['BookId', 'BookCost', 'Time'];

        var appendThis = [
          {
            BookId: resw.data.ID,
            BookCost: resw.data.Cost,
            Time: new Date(),
          },
        ];



        var newCsv='';
        await fs.stat('OrderDB.CSV', function (err, stat) {
          if (err == null) {
            console.log('File exists');
            var csv = json2csv(appendThis, { header: false }) + newLine;
            newCsv = csv.replace(/[\\"]/g, "");
            fs.appendFile('OrderDB.CSV', newCsv, function (err) {
              if (err) throw err;
              console.log('The "data to append" was appended to file!');
            });
           } 
        }
        );
        await axios
          .post('http://' + ip_order2 + ':' + port_order2 + '/appendOrder', {
            data: newCsv
          })
          .then(resu => {
          })
          .catch(error => {
            res.send("Something went wrong")
          });
        //send axios request to catalog server to update numbe rof items in the stock of that book
        //inorder to use restful api's put need to passed all the fields of the book with the new update
        await axios
          .put('http://' + catalog[0] + ':' + catalog[1] + '/update', {
            ID: resw.data.ID,
            Topic: resw.data.Topic,
            Cost: resw.data.Cost,
            NumItem: resw.data.NumItem - amount,//the updated data
            Name: resw.data.Name
          })
          .then(resu => {
          })
          .catch(error => {
            res.send("Something went wrong")
          });

        await axios
          .put('http://' + catalog[3] + ':' + catalog[4] + '/update', {
            ID: resw.data.ID,
            Topic: resw.data.Topic,
            Cost: resw.data.Cost,
            NumItem: resw.data.NumItem - amount,//the updated data
            Name: resw.data.Name
          })
          .then(resu => {
          })
          .catch(error => {
            //console.log(error)
          });

        console.log("Thank you for visiting BAZAR.com \n" + "Bought book '" + resw.data.Name + "'")
        res.send("Thank you for visiting BAZAR.com \n" + "Bought book '" + resw.data.Name + "'",);

      }

    }

    )
    .catch(error => {
      console.error(error);
    });


})

app.post("/appendOrder", (req,res)=>{
  let data= req.body.data;

  console.log(data)
   fs.stat('OrderDB.CSV', function (err, stat) {
    if (err == null) {
      fs.appendFile('OrderDB.CSV', data, function (err) {
        if (err) throw err;
        console.log('The "data to append" was appended to file!');
      });
     } 
  }
  );
  res.send('done')

})

app.listen(port, () => console.log("Purchase Service is running on port " + port));