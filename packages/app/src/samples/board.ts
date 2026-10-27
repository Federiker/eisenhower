import type { Board } from "@eisenhower/model";

/** An invented board: moving house, from the first boxes to the keys handed back. No card is outside a column. */
export function boardSample(): Board {
  return {
    columns: [
      { id: "col-ideas", name: "To sort out" },
      { id: "col-doing", name: "Under way" },
      { id: "col-booked", name: "Booked" },
      { id: "col-done", name: "Done" },
    ],
    cards: [
      {
        id: "card-van",
        title: "Hire a van",
        columnId: "col-ideas",
        summary: "A 3.5 tonne van for the Saturday; ask whether blankets come with it.",
        colour: 1,
      },
      {
        id: "card-post",
        title: "Redirect the post",
        columnId: "col-ideas",
        summary: "Six months of redirection, starting the day before the move.",
        colour: null,
      },
      {
        id: "card-broadband",
        title: "Broadband at the new flat",
        columnId: "col-ideas",
        summary: "Compare the two providers on the street; the router must arrive before the move.",
        colour: 4,
      },
      {
        id: "card-books",
        title: "Pack the books",
        columnId: "col-doing",
        summary: "Small boxes only: twelve so far, the study shelves still to do.",
        colour: 0,
      },
      {
        id: "card-kitchen",
        title: "Pack the kitchen",
        columnId: "col-doing",
        summary: "Keep a box of kettle, mugs and tea for the first evening.",
        colour: 5,
      },
      {
        id: "card-removals",
        title: "Removal firm",
        columnId: "col-booked",
        summary: "Two people from 8 am; the piano needs a third.",
        colour: 2,
      },
      {
        id: "card-cleaner",
        title: "End-of-tenancy clean",
        columnId: "col-booked",
        summary: "The Monday after the move, keys left with the neighbour.",
        colour: 6,
      },
      {
        id: "card-meter",
        title: "Read the meters",
        columnId: "col-done",
        summary: "Photographs of gas and electricity sent to both suppliers.",
        colour: 3,
      },
      {
        id: "card-boxes",
        title: "Collect boxes",
        columnId: "col-done",
        summary: "Forty from the shop on the corner.",
        colour: null,
      },
    ],
  };
}
