import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';


Todos = new Mongo.Collection('todos');
Lists = new Meteor.Collection('lists');

Router.route('/register');
Router.route('/login');
Router.route('/',{
  name: 'home',
  template: 'home'
});
Router.route('/list/:_id',{
  name: 'listPage',
  template: 'listPage',
  data: function(){
    var currentList = this.params._id;
    var currentUser = Meteor.userId();
    return Lists.findOne({_id: currentList,createdBy: currentUser});
  },
  onRun: function(){
    console.log('You triggered the run action');
    this.next();
  },
  onRerun: function(){
    console.log('You triggered the rerun action');
    this.next();
  },
  onBeforeAction: function(){
    console.log('You triggered the before action');
    var currentUser = Meteor.userId();
    if(currentUser){
      this.next();
    }
    else{
      this.render('login');
    }
  },
  onAfterAction: function(){
    console.log('You triggered the acter action');
  },
  onStop: function(){
    console.log('You triggered the stop action');
  },
  waitOn: function(){
    var currentList = this.params._id;
    return Meteor.subscribe('todos', currentList);
  }
});

Router.configure({
  layoutTemplate: 'main',
  loadingTemplate: 'loading'
});

if(Meteor.isClient){
    // client code goes here
    Template.todos.helpers({
      'todo': function(){
        var currentList = this._id
        var currentUser = Meteor.userId();
        return Todos.find({listId: currentList,createdBy: currentUser},{sort: {createdAt: -1}});
      }
    });

    Template.addToDo.events({
      'submit form': function(event){
        event.preventDefault();
        var todoName = $('[name = todoName]').val();
        var currentList = this._id;
        Meteor.call('createListItem',todoName,currentList);
      }
    });

    Template.todoItem.events({
      'click .delete-todo': function(event){
        event.preventDefault();
        var documentID = this._id;
        var confirm = window.confirm("Delete this task?");
        if(confirm){
          Meteor.call('removeListItem',documentID);
        }
      },

      'keyup [name=todoItem]': function(event){
        if(event.which == 13 || event.which == 27){
          $(event.target).blur();
        }
        else {
          var documentID = this._id;
          var todoName = $(event.target).val();
          Meteor.call('updateListItem',documentID,todoName);
        }
      },

      'change [type=checkbox]':function(){
        var documentID = this._id;
        var isCompleted = this.completed;
        if(isCompleted){
          Meteor.call('changeItemStatus',documentID,false);
        }
        else{
          Meteor.call('changeItemStatus',documentID,true);
        }
      }
    });

    Template.todoItem.helpers({
      'checked': function(){
        var isCompleted = this.completed;
        if(isCompleted){
          return "checked";
        }
        else {
          return "";
        }
      }
    });

    Template.todosCount.helpers({
      'totalTodos': function(){
        var currentList = this._id;
        return Todos.find({listId: currentList}).count();
      },
      'completedTodos':function(){
        var currentList= this._id;
        return Todos.find({completed:true, listId: currentList}).count();
      }
    });

    Template.addList.events({
      'submit form': function(event){
        event.preventDefault();
        var listName = $('[name=listName]').val();
        Meteor.call('createNewList',listName,function(error,results){
          if(error){
            console.log(error.reason);
          }
          else {
            Router.go('listPage',{_id: results});
            $('[name=listName]').val('');
          }
        });
      }
    });

    Template.lists.helpers({
      'list': function(){
        var currentUser = Meteor.userId();
        return Lists.find({createdBy: currentUser},{sort: {name: 1}});
      }
    });

    Template.register.events({
      'submit form': function(event){
        event.preventDefault();
      }
    });

    Template.login.events({
      'submit form': function(event){
        event.preventDefault();
      }
    });

    $.validator.setDefaults({
      rules: {
        email: {
          required: true,
          email: true
        },
        password: {
          required: true,
          minlength: 6
        }
      },
      messages: {
        email: {
          required: "You must enter an email address.",
          email: "You've entered an invalid email address."
        },
        password: {
          required: "You must enter a password.",
          minlength: "Your password must be at least {0} characters."
        }
      }
    });

    Template.login.onRendered(function(){
      var validator = $('.login').validate({
        submitHandler: function(){
          var email = $('[name=email]').val();
          var password = $('[name=password]').val();
          Meteor.loginWithPassword(email,password,function(error){
            if(error){
              if(error.reason == "User not found"){
                validator.showErrors({
                  email: "That email doesn't belong to a registered user."
                });
              }
              if(error.reason == "Incorrect password"){
                validator.showErrors({
                  password: "You entered an incorrect password."
                });
              }
            }
            else{
              var currentRoute = Router.current().route.getName();
              if(currentRoute == 'login'){
                Router.go('home');
              }
            }
          });
        }
      });
    });

    Template.login.onDestroyed(function(){
      console.log("The 'login' template was just destroyed.");
    });

    Template.register.onRendered(function(){
      var validator = $('.register').validate({
        submitHandler: function(){
          var email = $('[name=email]').val();
          var password = $('[name=password]').val();
          Accounts.createUser({
            email: email,
            password: password
          },function(error){
            if(error){
              if(error.reason == "Email already exists."){
                validator.showErrors({
                  email: "That email already belongs to a registered user."
                });
              }
            }
            else{
              Router.go('home');
            }
          });
        }
      });
    });

    Template.navigation.events({
      'click .logout': function(event){
        event.preventDefault();
        Meteor.logout();
        Router.go('login');
      }
    });

    Template.lists.onCreated(function(){
      this.subscribe('lists');
    })
}

if(Meteor.isServer){
  Meteor.publish('lists',function(){
    var currentUser = this.userId;
    return Lists.find({createdBy: currentUser});
  });
  Meteor.publish('todos', function(currentList){
    var currentUser = this.userId;
    return Todos.find({ createdBy: currentUser , listId: currentList})
  });

  Meteor.methods({
    'createNewList': function(listName){
      var currentUser = Meteor.userId();
      check(listName,String);
      if(listName == ""){
        listName = defaultName(currentUser);
      }
      var data = ({
        name: listName,
        createdBy: currentUser
      });
      if(!currentUser){
        throw new Meteor.Error("not-logged-in", "You're not logged-in.");
      }
      return Lists.insert(data);
    },
    'createListItem': function(itemName,listId){
      var currentUser = Meteor.userId();
      check(itemName,String);
      if(itemName == ""){
        itemName = defaultNameItem(currentUser,listId);
      }
      var data = ({
        name: itemName,
        createdBy: currentUser,
        completed: false,
        createdAt: new Date(),
        listId: listId
      });
      if(!currentUser){
        throw new Meteor.Error("not-logged-in","You're not logged-in.");
      }

      var currentList = Lists.findOne(listId);
      if(currentList.createdBy != currentUser){
        throw new Meteor.Error("invalid-user", "You don't own that list.");
      }
      Todos.insert(data);
    },
    'updateListItem': function(documentID,itemName){
      var currentUser = Meteor.userId();
      check(itemName,String);
      if(itemName == ""){
        itemName = "Undefined";
      }

      var data = {
        _id: documentID,
        createdBy: currentUser
      };

      if(!currentUser){
        throw new Meteor.Error("not-logged-in", "You're not logged-in.");
      }
      Todos.update(data,{$set: {name: itemName}});
    },
    'changeItemStatus': function(documentID,status){
      check(status,Boolean);
      var currentUser = Meteor.userId();
      var data = {
        _id: documentID,
        createdBy: currentUser
      };
      if(!currentUser){
        throw new Meteor.Error("not-logged-in", "You're not logged-in.");
      }
      Todos.update(data,{$set: {completed: status}});
    },
    'removeListItem': function(documentID){
      var currentUser = Meteor.userId();
      var data = {
        _id: documentID,
        createdBy: currentUser
      };
      if(!currentUser){
        throw new Meteor.Error("not-logged-in","You're not logged-in.");
      }
      Todos.remove(data);
    }
  });

  function defaultName(currentUser) {
    var nextLetter = 'A'
    var nextName = 'List ' + nextLetter;
    while (Lists.findOne({ name: nextName, createdBy: currentUser })) {
        nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
        nextName = 'List ' + nextLetter;
    }
    return nextName;
  }

  function defaultNameItem(currentUser,listId) {
    var nextLetter = 'A'
    var nextName = 'Todo ' + nextLetter;
    while (Todos.findOne({ name: nextName, createdBy: currentUser, listId: listId })) {
        nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
        nextName = 'Todo ' + nextLetter;
    }
    return nextName;
  }
}
