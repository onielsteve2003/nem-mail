import type { Category } from '@nem/shared';

/**
 * Seed corpus for the category model, written for this project (no third-party data).
 * EVAL is held out from training and only used to measure accuracy.
 */
export interface CategorySample {
	from: string;
	subject: string;
	body: string;
	category: Category;
}

const s = (category: Category, from: string, subject: string, body: string): CategorySample => ({
	from,
	subject,
	body,
	category
});

export const CATEGORY_CORPUS: readonly CategorySample[] = [
	// Primary: people writing to you.
	s(
		'primary',
		'ada@example.com',
		'Lunch Thursday?',
		'Are we still on for lunch? I can meet at noon.'
	),
	s(
		'primary',
		'grace@example.org',
		'Draft for review',
		'Attached the draft. Could you take a look before Friday?'
	),
	s(
		'primary',
		'mum@family.example',
		'Sunday dinner',
		'Dinner at 7 on Sunday. Bring the kids if they are free.'
	),
	s(
		'primary',
		'tom@example.net',
		'Quick question',
		'Do you have the contract wording from last week?'
	),
	s('primary', 'lena@example.com', 'Re: trip plans', 'I booked the train. Can you sort the hotel?'),
	s(
		'primary',
		'sam@work.example',
		'Notes from the call',
		'Sharing my notes. Let me know if I missed anything.'
	),
	s('primary', 'olu@example.org', 'Thanks!', 'Thanks so much for helping with the move yesterday.'),
	s(
		'primary',
		'kim@example.com',
		'Interview next week',
		'We would like to invite you for an interview on Tuesday.'
	),
	s(
		'primary',
		'dan@example.net',
		'Can you call me?',
		'Call me when you get a minute, it is about the budget.'
	),
	s(
		'primary',
		'ana@example.com',
		'Photos from the weekend',
		'Here are the photos I promised. The hike was great.'
	),
	s(
		'primary',
		'joe@work.example',
		'Budget numbers',
		'I think the Q3 forecast is off. Can we review it together?'
	),
	s('primary', 'mia@example.org', 'Coffee?', 'Want to grab coffee on Wednesday morning?'),
	// Promotions: marketing and deals.
	s(
		'promotions',
		'deals@lumen.example',
		'30% off headphones this week',
		'Our best headphones are on sale until Sunday. Shop now.'
	),
	s(
		'promotions',
		'offers@shoply.example',
		'Flash sale ends tonight',
		'Save up to 50% on everything. Use code FLASH50 at checkout.'
	),
	s(
		'promotions',
		'news@outdoors.example',
		'New arrivals for spring',
		'Discover the new collection. Free shipping on orders over $50.'
	),
	s(
		'promotions',
		'hello@coffee.example',
		'A treat for you',
		'Get a free pastry with any coffee this weekend. Show this coupon.'
	),
	s(
		'promotions',
		'marketing@travel.example',
		'Last-minute getaways',
		'Book now and save on hotels. Limited time deals.'
	),
	s(
		'promotions',
		'store@books.example',
		'Buy two, get one free',
		'Our biggest book sale of the year. Shop the bestsellers.'
	),
	s(
		'promotions',
		'promo@fit.example',
		'Your exclusive member discount',
		'Members save 20% on gym gear. Offer ends Friday.'
	),
	s(
		'promotions',
		'deals@home.example',
		'Black Friday early access',
		'Early access to doorbuster deals. Shop before everyone else.'
	),
	s(
		'promotions',
		'shop@style.example',
		'Picked for you',
		'New styles we think you will love. Shop the look.'
	),
	s(
		'promotions',
		'offers@food.example',
		'Free delivery this week',
		'Order your groceries with free delivery. Use promo code FREE.'
	),
	// Social: social networks and people's activity.
	s(
		'social',
		'notify@friendly.example',
		'Maya commented on your photo',
		'Maya commented: "Love this!" See the conversation.'
	),
	s(
		'social',
		'no-reply@pixgram.example',
		'You have 3 new followers',
		'Jon, Ali and 1 other started following you.'
	),
	s(
		'social',
		'invitations@linkup.example',
		'Sara wants to connect',
		'Sara invited you to connect. Accept the invitation.'
	),
	s(
		'social',
		'notify@friendly.example',
		'Tom tagged you in a post',
		'Tom tagged you in a photo from the party.'
	),
	s(
		'social',
		'events@friendly.example',
		'Event invitation: board games night',
		'Lee invited you to an event on Friday. Going?'
	),
	s(
		'social',
		'no-reply@chirp.example',
		'Ali mentioned you',
		'Ali mentioned you in a reply. See what they said.'
	),
	s(
		'social',
		'notify@linkup.example',
		'Congratulate Dan on his new job',
		'Dan started a new position. Say congrats.'
	),
	s(
		'social',
		'no-reply@pixgram.example',
		'Your post is getting likes',
		'Your photo has 25 likes and 4 comments.'
	),
	s(
		'social',
		'friends@friendly.example',
		'Friend request from Nia',
		'Nia sent you a friend request. Confirm or delete.'
	),
	s(
		'social',
		'notify@clips.example',
		'New video from a channel you follow',
		'A creator you follow posted a new video.'
	),
	// Updates: receipts, orders, accounts, alerts.
	s(
		'updates',
		'orders@shoply.example',
		'Your order has shipped',
		'Your order #4821 is on its way. Track your package.'
	),
	s(
		'updates',
		'receipts@coffee.example',
		'Your receipt',
		'Thanks for your purchase. Total paid $12.40. Receipt attached.'
	),
	s(
		'updates',
		'no-reply@bank.example',
		'Your statement is ready',
		'Your monthly statement is ready to view in online banking.'
	),
	s(
		'updates',
		'security@account.example',
		'New sign-in to your account',
		'A new sign-in from Chrome on Windows. If this was you, no action needed.'
	),
	s(
		'updates',
		'no-reply@airline.example',
		'Your flight is confirmed',
		'Booking confirmation for your flight to Lisbon. Check in opens 24 hours before.'
	),
	s(
		'updates',
		'billing@cloud.example',
		'Invoice available',
		'Your invoice for October is available. Payment due in 30 days.'
	),
	s(
		'updates',
		'notifications@code.example',
		'Build passed on main',
		'CI passed on all checks for your pull request.'
	),
	s(
		'updates',
		'reminders@dentist.example',
		'Appointment reminder',
		'Reminder: your appointment is on Tuesday at 9:30.'
	),
	s(
		'updates',
		'no-reply@delivery.example',
		'Delivered: your parcel',
		'Your parcel was delivered to the front door at 2:14pm.'
	),
	s(
		'updates',
		'account@stream.example',
		'Your password was changed',
		'Your password was changed successfully. Contact support if this was not you.'
	),
	s(
		'updates',
		'no-reply@workspace.example',
		'Your weekly summary is ready',
		'Here is what happened in your workspace this week.'
	),
	// Forums: mailing lists and discussion groups.
	s(
		'forums',
		'list@runners.example',
		'[runners] Saturday long run route',
		'Meet at the park gate at 8. 14 km, easy pace.'
	),
	s(
		'forums',
		'dev@lists.example',
		'[dev] Proposal: drop old browser support',
		'Thoughts on dropping support next release? Reply to the list.'
	),
	s(
		'forums',
		'garden@groups.example',
		'[garden-club] Seed swap this month',
		'Bring your extra seeds to the swap. Reply to this thread.'
	),
	s(
		'forums',
		'forum@makers.example',
		'New reply in "3D printer settings"',
		'A member replied to a topic you follow in the forum.'
	),
	s(
		'forums',
		'digest@community.example',
		'Daily digest: 12 new topics',
		'Today in the community: 12 new topics and 40 replies.'
	),
	s(
		'forums',
		'list@photo.example',
		'[photo-club] Monthly challenge theme',
		'This month the theme is reflections. Post to the group.'
	),
	s(
		'forums',
		'q-and-a@stacks.example',
		'New answer to your question',
		'Someone answered your question about async iterators.'
	),
	s(
		'forums',
		'list@parents.example',
		'[school-parents] Bake sale volunteers',
		'We need volunteers for the bake sale. Reply to the group.'
	),
	s(
		'forums',
		'discuss@books.example',
		'Thread update: book club pick',
		'New posts in the discussion thread you follow.'
	),
	s(
		'forums',
		'list@cycling.example',
		'[cycling] Sunday ride cancelled',
		'Rain forecast, so the group ride is off. Unsubscribe from this list anytime.'
	)
];

export const CATEGORY_EVAL: readonly CategorySample[] = [
	s(
		'primary',
		'rob@example.com',
		'Dinner Friday?',
		'I booked a table for four at 8. Can you make it?'
	),
	s(
		'primary',
		'nora@work.example',
		'Slides for tomorrow',
		'Could you review the slides before the meeting?'
	),
	s('primary', 'pat@example.org', 'Happy birthday!', 'Hope you have a lovely day with the family.'),
	s(
		'primary',
		'eve@example.net',
		'Re: the report',
		'Thanks, I will send the final version tonight.'
	),
	s(
		'primary',
		'max@example.com',
		'Help with the move',
		'Could you help me carry the boxes on Saturday?'
	),
	s(
		'promotions',
		'deals@gadgets.example',
		'Weekend sale: 25% off',
		'Save on laptops and tablets this weekend only. Shop now.'
	),
	s(
		'promotions',
		'offers@beauty.example',
		'Your coupon inside',
		'Use code GLOW15 for 15% off your next order.'
	),
	s(
		'promotions',
		'news@shoes.example',
		'New running shoes just dropped',
		'Shop the new collection with free shipping.'
	),
	s(
		'promotions',
		'promo@pizza.example',
		'Two for one tonight',
		'Order any large pizza and get a second free. Limited time.'
	),
	s(
		'promotions',
		'store@toys.example',
		'Holiday gift guide',
		'Our top picks and deals for the holidays. Shop early.'
	),
	s(
		'social',
		'notify@friendly.example',
		'Jo commented on your post',
		'Jo commented on your post. See the conversation.'
	),
	s('social', 'no-reply@pixgram.example', 'New follower', 'Ken started following you.'),
	s(
		'social',
		'invitations@linkup.example',
		'Invitation to connect',
		'Rae wants to connect with you. Accept the invitation.'
	),
	s('social', 'notify@chirp.example', 'You were mentioned', 'Bea mentioned you in a post.'),
	s(
		'social',
		'events@friendly.example',
		'Party invitation',
		'Ola invited you to a birthday party. Going?'
	),
	s(
		'updates',
		'orders@books.example',
		'Order confirmed',
		'Your order #9921 is confirmed and will ship soon.'
	),
	s(
		'updates',
		'no-reply@bank.example',
		'Payment received',
		'We received your payment. Your balance is up to date.'
	),
	s(
		'updates',
		'security@mail.example',
		'Security alert',
		'A new device signed in to your account.'
	),
	s(
		'updates',
		'no-reply@delivery.example',
		'Out for delivery',
		'Your package is out for delivery today. Track it.'
	),
	s(
		'updates',
		'billing@phone.example',
		'Your bill is ready',
		'Your monthly bill is ready to view.'
	),
	s(
		'forums',
		'list@chess.example',
		'[chess-club] Tournament pairings',
		'Pairings for round 2 are posted. Reply to the list.'
	),
	s(
		'forums',
		'forum@cooking.example',
		'New reply in "sourdough tips"',
		'A member replied to a topic you follow.'
	),
	s(
		'forums',
		'digest@community.example',
		'Weekly digest: 8 new topics',
		'This week in the community: 8 new topics.'
	),
	s(
		'forums',
		'list@hiking.example',
		'[hiking] Trail closures',
		'The north trail is closed this weekend. Post to the group.'
	),
	s(
		'forums',
		'q-and-a@stacks.example',
		'Your question got an answer',
		'Someone answered your question about CSS grid.'
	)
];
