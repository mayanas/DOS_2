//helps manage servers and routes on top of Node.js
const express = require('express');

//Parse request body, using the req.body
const bodyParser = require('body-parser');

//Axios to help in requests to other services
const axios = require('axios');

//define app to be used for the routes
const app = express();
//port of running app
const port = 3000;

//ip address & port of catalog service 
let catalog = ['192.168.1.106', '3001', 0, '192.168.1.106', '3002', 0];

//ip address & port of order service 
let order = ['192.168.1.106', '3003', 0, '192.168.1.106', '3004', 0];

let chosen_replica = 0;//0->replica1, 3->replica2

//body parser to help in parsing the requests' body
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(bodyParser.json());
var start_time;
var end_time;

//cache array
var cache = [];

//search if request is  cached  
searchInCache = (url) => {
  var flag = 0;
  var result;
  cache.forEach(element => {
    if (element.url == url) {
      flag = 1;
      element.count += 1;
      result = element.result;
    }
  });
  cache.forEach(element => {
    console.log(element)
  })
  if (flag == 0) {
    return '';
  }
  else {
    return result;
  }

}

//return the index of the least frequent request
replacementCache = () => {
  var minCount = Number.MAX_SAFE_INTEGER+1;
  console.log(minCount);
  let index = 0;
  for (var i = 0; i < cache.length; i++) {
    if (cache[i].count < minCount) {
      minCount = cache[i].count;
      index = i;
      
    }
  }
  console.log(minCount);
  return index;

}

//to add the new request to cache
addToCache = (url, result) => {
  //to put limit for number of items in cache
  if (cache.length == 10) {
    //if passed the limit then need to replace least frequent request by replacementCache function
    var index = replacementCache();
    //replace the index returned from replacementCache func
    cache.splice(index, 1, {
      url: url,
      result: result,
      count: 1
    });
  }
  else{
    //if not passing the limit add new request to cache 
    cache.push({
      url: url,
      result: result,
      count: 1
    });
  }

}

//search request to get books according to topic passed as json in the request body 
app.get("/search", (req, res) => {
  let dataTobeSent = ""
  let query = req.body.topic;
  // /search/query
  if (catalog[2] < catalog[5]) {
    catalog[2]++;
    chosen_replica = 0;
  } else {
    catalog[5]++;
    chosen_replica = 3;
  }

  start_time = Date.now();
  console.log("--------------------------------------------------------------------------");
  console.log("Timer started ...\n");///////////////////////////////////////

  console.log("Start search in cache ...");
  let searchCache = searchInCache(`/search/${query}`);
  //console.log(searchCache);
  if (searchCache == '') {
    console.log("Not found in cache ...");
    axios.get('http://' + catalog[chosen_replica] + ':' + catalog[chosen_replica + 1] + '/search',
      {
        data: {
          topic: query
        }
      })
      .then(resw => {
        if (resw.data == 'error' || resw.data == 'no books found related to this topic') {
          console.log(resw.data);
          dataTobeSent += resw.data
        }
        else {

          dataTobeSent += "list of books related to this topic was found\n"
          resw.data.forEach(element => {
            dataTobeSent += "- Book Number is '" + element.ID + "' and Book Name is '" + element.Name + "'\n"
          });

          // console.log(dataTobeSent);
          addToCache(`/search/${query}`, dataTobeSent);
        }
        catalog[chosen_replica + 2]--;

        end_time = Date.now() - start_time;
        console.log(`Timer stoped, Duration is: ${end_time} ms`);///////////////////////////////////////
        res.send(dataTobeSent);
      })
      .catch(error => {
        console.error(error);
      });
  }
  else {
    console.log("Found in cache ...");
    end_time = Date.now() - start_time;
    console.log(`Timer stoped, Duration is: ${end_time} ms`);///////////////////////////////////////
    res.send(searchCache);
  }
})


//info request to get book information which number passed in the request body
app.get("/info", (req, res) => {
  let dataTobeSent = ""
  //get the topic by parsing the request body 
  let query = req.body.item_number;
  if (catalog[2] < catalog[5]) {
    catalog[2]++;
    chosen_replica = 0;
  } else {
    catalog[5]++;
    chosen_replica = 3;
  }

  start_time = Date.now();
  console.log("--------------------------------------------------------------------------");
  console.log("Timer started ...\n");///////////////////////////////////////

  console.log("Start search in cache ...");
  let searchCache = searchInCache(`/info/${query}`);
  if (searchCache == '') {
    console.log("Not found in cache ...");
    //axios route to send a request to the catalog service using its ip and port
    //parameter passed in the body
    axios.get('http://' + catalog[chosen_replica] + ':' + catalog[chosen_replica + 1] + '/info',
      {
        data: {
          item_number: query
        }
      })
      .then(resw => {
        //show the results
        if (resw.data == 'Somthing wrong occurred!' || resw.data == 'Book does not exist, make sure to enter valid item number') {
          console.log(resw.data);
          dataTobeSent = resw.data
        }
        else {
          //if book found return its info

          dataTobeSent = "Book Found\n"
          dataTobeSent += "- Book Name is '" + resw.data.Name + "'\n"
          dataTobeSent += "- Book Topic is '" + resw.data.Topic + "'\n"
          dataTobeSent += "- Book Cost is '" + resw.data.Cost + "'\n"
          dataTobeSent += "- Book Number of items is '" + resw.data.NumItem + "'\n";
          //console.log(dataTobeSent);
          addToCache(`/info/${query}`, dataTobeSent);
        }
        end_time = Date.now() - start_time;
        console.log(`Timer stoped, Duration is: ${end_time} ms`);///////////////////////////////////////
        res.send(dataTobeSent)
      })
      .catch(error => {
        console.error(error);
      });
  }
  else{
    console.log("Found in cache ...");
    end_time = Date.now() - start_time;
    console.log(`Timer stoped, Duration is: ${end_time} ms`);///////////////////////////////////////
    res.send(searchCache);
  }
})

//purchase request inorder to buy a book by passing its number in the URI
app.post("/purchase/:item_number", (req, res) => {
  //get the item number from the parameters
  let query = req.params.item_number;
  if (order[2] < order[5]) {
    order[2]++;
    chosen_replica = 0;
  } else {
    order[5]++;
    chosen_replica = 3;
  }

  start_time = Date.now();
  console.log("--------------------------------------------------------------------------");
  console.log("Timer started ...\n");///////////////////////////////////////
  //axios request to purchase server providing its ip+port and pass the item number and the amount of decrement 
  //using put request to update the number of items in the stock
  axios
    .post('http://' + order[chosen_replica] + ':' + order[chosen_replica + 1] + '/purchase', {
      item_number: query,
      amount: 1,
      catalog1: catalog[2],
      catalog2: catalog[5]
    })
    .then(resw => {

      console.log(resw.data + '\n');
      end_time = Date.now() - start_time;
      console.log(`Timer stoped, Duration is: ${end_time} ms`);///////////////////////////////////////

      order[chosen_replica + 2]--;
      //show the result of purchasing process
      res.send(resw.data);
    })
    .catch(error => {
      console.error(error);
    });
})


//invalidate request sent by the catalog when there is update
app.put("/invalidateRequest",(req, res)=>{
  let query = req.body;

  for(var i=0; i<cache.length;i++){
    
    if(cache[i].url==`/search/${query.Topic}`){
      cache.splice(i,1);//remove item from array 
    }
    else if(cache[i].url==`/info/${query.ID}`){
      cache.splice(i,1);//remove item from array 
    }
  }

  
})

app.listen(port, () => console.log(`Front-End service is running on port ` + port));