// orders.js — recipes, customers, tickets, patience, scoring.
// One job: everything about "what the customers want and what it is worth".
(function () {
  // A component: raw ingredient -> station task -> finished ingredient.
  // station: 'board' | 'stove' | 'pot' ; task seconds are the cook/chop time.
  var RECIPES = {
    salad: {
      name: 'Garden Salad', base: 100,
      components: [
        { raw: 'Tomato', done: 'Chopped Tomato', station: 'board', task: 2.2 },
        { raw: 'Lettuce', done: 'Chopped Lettuce', station: 'board', task: 2.2 }
      ]
    },
    ramen: {
      name: 'Shoyu Ramen', base: 150,
      components: [
        { raw: 'Noodle', done: 'Boiled Noodle', station: 'pot', task: 4.0 },
        { raw: 'Egg', done: 'Chopped Egg', station: 'board', task: 2.2 }
      ]
    },
    burger: {
      name: 'Smash Burger', base: 200,
      components: [
        { raw: 'Patty', done: 'Fried Patty', station: 'stove', task: 4.0 },
        { raw: 'Lettuce', done: 'Chopped Lettuce', station: 'board', task: 2.2 }
      ]
    }
  };

  var CUSTOMERS = ['Mira', 'Bram', 'Sari', 'Dimas', 'Lani', 'Raka', 'Putri', 'Agus', 'Nadia', 'Fajar'];
  var RECIPE_KEYS = ['salad', 'ramen', 'burger'];

  var nextTicketId = 1;

  function makeTicket(day, rng) {
    var key = RECIPE_KEYS[Math.floor(rng() * RECIPE_KEYS.length)];
    var recipe = RECIPES[key];
    var patienceMax = day === 1 ? 60 : day === 2 ? 50 : 40;
    return {
      id: nextTicketId++,
      customer: CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)],
      recipeKey: key,
      dish: recipe.name,
      base: recipe.base,
      components: recipe.components.map(function (c) {
        return { raw: c.raw, done: c.done, station: c.station, task: c.task, state: 'todo' };
      }),
      patience: patienceMax,
      patienceMax: patienceMax,
      state: 'waiting', // waiting | prepping | ready | gone | served
      taken: false
    };
  }

  // Score for serving a ticket. PERFECT when patience is still above 50%.
  // Combo multiplies: combo 1 -> x1, combo 2 -> x1.25, ... capped at x3.
  function scoreServe(ticket, combo) {
    var perfect = ticket.patience > ticket.patienceMax * 0.5;
    var mult = Math.min(3, 1 + 0.25 * (combo - 1));
    var points = Math.round(ticket.base * mult);
    var bonus = 0;
    if (perfect) bonus = Math.round(ticket.base * 0.5 * mult);
    var tip = 10 * combo;
    return { points: points, bonus: bonus, tip: tip, total: points + bonus + tip, perfect: perfect, mult: mult };
  }

  window.KitchenOrders = {
    RECIPES: RECIPES,
    makeTicket: makeTicket,
    scoreServe: scoreServe
  };
})();
