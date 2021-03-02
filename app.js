require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const multer = require('multer');
const path = require('path');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true , useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

const productSchema = new mongoose.Schema ({
  title: String,
  content: String,
  img: String,
  price: Number,
  category: Number
});

const Product = mongoose.model('Product', productSchema);

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  secret: String,
  cart: {
          items: [{
            productId: {type: mongoose.Types.ObjectId,
                ref: 'Product'},
            qty: Number
          }],
          totalPrice: Number
        }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/" , function(req , res){
  res.render("home" , {req: req});
});

app.post("/" , function(req , res){
  req.logout();
  res.redirect("/");
});

app.get("/products" , function(req , res){
  Product.find(function (err, products) {
  if (err){ return console.log(err);}
  else{
    res.render("products", {
      req:req,
      products:products
      });
  }
})
});



const Storage = multer.diskStorage({
  destination: "./public/uploads",
  filename: (req , file , cb)=>{
    cb(null , file.fieldname+"_"+Date.now()+path.extname(file.originalname));
  }
});

const upload = multer({
  storage:Storage
}).single('file');

app.get("/comproduct" , function(req , res){
  res.render("comproduct" , {req: req});
});

app.post("/comproduct" , upload ,  function(req , res){
  var cat = 1;
  if(req.body.category == 2)cat = 2;
  if(req.body.category == 3)cat = 3;
  const item = {
    title: req.body.title,
    content: req.body.content,
    category: cat,
    price: req.body.price,
    img: req.file.filename
  };

  const product = new Product(item);
  product.save(function(err){
    if(err)console.log(err);
    else {
      res.redirect("/");
    }
  });
});

app.get("/blog" , function(req , res){
  res.render("blog" , {req: req});
});

app.get("/signup" , function(req , res){
  res.render("signup" , {req: req});
});

app.post("/signup", function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      });
    }
  });

});

app.get("/login" , function(req , res){
  res.render("login" , {req: req});
});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      });
    }
  });
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/");
  });

  app.post("/addToCart", function(req, res){

    Product.findById(req.body.id,function(err , product){
      if(err){console.log(err)}
      else{
        if(!req.user){
          res.redirect("/");
        }
        else{
          const per = req.user;
          console.log(per);
          //req.user.addToCart(product);
          const cart = per.cart;
          if(cart.items.length == 0){
            cart.items.push({productId: product._id , qty: 1});
            cart.totalPrice = product.price;
          } else{
            let isExist = cart.items.findIndex(obj => new String(obj.productId).trim() == new String(product._id).trim());
            console.log(isExist);
            if(isExist == -1){
              cart.items.push({productId: product._id , qty: 1});
              cart.totalPrice += product.price;
            }
            else{
              isExist =
              cart.items[isExist].qty++;
              cart.totalPrice += product.price;
            }
          }
          per.save();
          res.redirect('/');
        }
      }
    });

  });

  app.get("/cart" , function(req , res){
    console.log(req.user.cart.totalPrice);
    req.user
        .populate('cart.items.productId')
        .execPopulate()
        .then(user => {
            console.log(user);
            res.render('cart', { req: req });
        })
        .catch(err => console.log(err));
  });

  app.get("/add" , function(req , res){
    Product.findById(req.body.id,function(err , product){
      console.log(product);
      if(err){console.log(err)}
      else{
        if(!req.user){
          res.redirect("/");
        }
        else{
          const per = req.user;
          const cart = per.cart;
            let isExist = cart.items.findIndex(obj => new String(obj.productId).trim() == new String(product._id).trim());
              isExist =
              cart.items[isExist].qty++;
              cart.totalPrice += product.price;
          per.save();
          res.redirect('/products');
        }
      }
    });
  })

app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
