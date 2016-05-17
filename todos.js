import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';


Todos = new Mongo.Collection('todos');
Todos.insert({
    name: "Walk the dog",
    completed: false,
    createdAt: new Date()
});
if(Meteor.isClient){
    // client code goes here
    Template.todos.helpers({
      'todo': function(){
        return Todos.find({},{sort: {createdAt: -1}});
      }
    })
}

if(Meteor.isServer){
    // server code goes here
}
