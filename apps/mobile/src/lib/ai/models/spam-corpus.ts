/**
 * Seed corpus for the spam model, written for this project (no third-party data).
 * Ham includes promotions and newsletters on purpose: marketing mail is not spam.
 * EVAL is held out from training and only used to measure accuracy.
 */

export interface SpamSample {
	text: string;
	isSpam: boolean;
}

const spam = (text: string): SpamSample => ({ text, isSpam: true });
const ham = (text: string): SpamSample => ({ text, isSpam: false });

export const SPAM_TRAINING: readonly SpamSample[] = [
	spam('CONGRATULATIONS! You have won a free iPhone. Claim your prize now before it expires.'),
	spam('You were selected as our lucky winner! Click here to claim your cash reward today.'),
	spam('Urgent: your account will be suspended. Verify your password immediately.'),
	spam('We detected unusual activity. Confirm your login details or your account will be closed.'),
	spam('Turn $100 into $10,000 this week. Guaranteed returns with zero risk.'),
	spam('Limited spots left! Earn passive income from home with our crypto bot.'),
	spam('Delivery failed: pay $1.99 to reschedule your parcel. Pay now.'),
	spam('Your package is on hold. A small customs fee is required to release it.'),
	spam('Dear beneficiary, a sum of 4.5 million dollars has been approved for transfer to you.'),
	spam('I am a prince and need your help to move funds. You will receive 30 percent.'),
	spam('Cheap meds online, no prescription needed. Lowest prices guaranteed.'),
	spam('Lose 20 pounds in 10 days with this miracle pill. Doctors hate it.'),
	spam('Hot singles in your area want to meet you tonight. Click to chat.'),
	spam('Your computer is infected! Call our support line now to remove the virus.'),
	spam('Final notice: unpaid invoice attached. Open the attachment to avoid legal action.'),
	spam('You have an unclaimed tax refund. Enter your bank details to receive it.'),
	spam('Act fast! This exclusive offer expires in 24 hours. 100% free, no catch.'),
	spam('Get rich quick with this one simple trick. Thousands of dollars every week.'),
	spam('Your Netflix subscription failed. Update your card details to avoid suspension.'),
	spam('Work from home and earn $5000 per week. No experience required. Apply now.'),
	spam('Exclusive investment opportunity. Double your money in 7 days, risk free.'),
	spam('You have been chosen for a free gift card worth $500. Claim within 48 hours.'),
	spam('Re-enter your password to keep your mailbox active. Storage limit exceeded.'),
	spam('Winner winner! Spin the wheel to collect your bonus cash prize.'),
	spam('Buy followers and likes now. Instant delivery, cheapest price on the market.'),
	spam('Your bank account has been locked. Click the secure link to unlock it now.'),
	spam('Congratulations, your email address won the international lottery draw.'),
	spam('Payment received of $899 for a laptop. If you did not order it, call us urgently.'),
	spam('Act now to refinance at zero percent. Pre-approved, no credit check.'),
	spam('Unlock your free trial of premium casino credits. Bet now and win big.'),
	spam('Verify your identity within 24 hours or your wallet will be frozen.'),
	spam('Claim the inheritance left to you by a distant relative. Reply with your details.'),
	spam('Amazing deal on replica watches and designer bags at 90% off.'),
	spam('Your PayPal account is limited. Confirm your card number to restore access.'),
	spam('Earn bitcoin daily with no effort. Guaranteed profit, join the program now.'),
	spam('Urgent wire transfer needed. The CEO asked me to buy gift cards today.'),
	spam('You qualify for a government grant of $9,000. Pay the processing fee to receive it.'),
	spam('Click here to stop being charged. Your subscription renews today for $499.'),
	spam('Free money! No strings attached. Cash prize waiting in your account.'),
	spam('Shocking secret to erase debt overnight. Banks do not want you to know.')
];

export const HAM_TRAINING: readonly SpamSample[] = [
	ham('Hi, are we still on for lunch on Thursday? I can meet near the office at noon.'),
	ham('Attached are the slides for tomorrow. Let me know if anything needs to change.'),
	ham('Thanks for your help with the move. The boxes are all unpacked now.'),
	ham('The design review is moved to Friday at 3pm. Same meeting room.'),
	ham('Can you send me the latest draft of the report before the weekly sync?'),
	ham('Mum says dinner is at 7 on Sunday. Bring the kids if they are free.'),
	ham('Your order has shipped. Track the delivery in your account.'),
	ham('Your receipt for the coffee subscription. Thanks for your purchase.'),
	ham('30% off headphones this week only. Free delivery on orders over $50.'),
	ham('New arrivals in the spring collection. Shop the sale while it lasts.'),
	ham('Weekly digest: 5 new posts in the runners club forum.'),
	ham('Someone commented on your photo. See the conversation.'),
	ham('Your flight to Lisbon is confirmed. Check in opens 24 hours before departure.'),
	ham('The pull request was merged. CI passed on all checks.'),
	ham('Reminder: dentist appointment on Tuesday at 9:30.'),
	ham('Invoice for October consulting work is attached. Payment due in 30 days.'),
	ham('The team offsite agenda is ready. Please review the travel plan.'),
	ham('Happy birthday! Hope you have a lovely day with the family.'),
	ham('Your monthly statement is ready to view in online banking.'),
	ham(
		'Security alert: a new sign-in to your account from Chrome on Windows. If this was you, no action is needed.'
	),
	ham('Here are the notes from the client call. Next steps are listed at the bottom.'),
	ham('Could you review the budget numbers? I think the Q3 forecast is off.'),
	ham('Library notice: the book you reserved is ready for pickup.'),
	ham('The school trip form needs a signature by Friday.'),
	ham('Newsletter: ten recipes for quick weeknight dinners.'),
	ham('Your password was changed successfully. Contact support if you did not do this.'),
	ham('Let us catch up next week. Coffee on Wednesday morning?'),
	ham('Thanks for applying. We would like to schedule an interview next week.'),
	ham('Photos from the wedding are in the shared album.'),
	ham('Your parcel was delivered to the front door at 2:14pm.'),
	ham('The build failed on main. Looks like a flaky test in the search module.'),
	ham('Member rewards: you have 340 points. Redeem them in the app.'),
	ham('Rent reminder from the landlord: due on the first of the month as usual.'),
	ham('New comment in the project thread about the release timeline.'),
	ham('Join us for the community garden meetup on Saturday morning.'),
	ham('Your subscription renews next month. You can manage it in settings.'),
	ham('Quick question about the contract wording in section 4.'),
	ham('The weekend weather looks great for a hike. Want to join?'),
	ham('Course update: week 3 lessons and the quiz are now available.'),
	ham('Webinar recording and slides are now available to attendees.')
];

/** Training set: seed spam and ham together. */
export const SPAM_CORPUS: readonly SpamSample[] = [...SPAM_TRAINING, ...HAM_TRAINING];

/** Held-out evaluation set (never trained on). */
export const SPAM_EVAL: readonly SpamSample[] = [
	spam('Congratulations! You are our lucky winner. Claim your free prize today.'),
	spam('Your account will be suspended unless you verify your password now.'),
	spam('Guaranteed profit with our crypto trading bot. Double your money fast.'),
	spam('Pay a small fee to release your parcel held at customs.'),
	spam('Earn $3000 a week from home, no experience needed. Apply now.'),
	spam('You have won the lottery. Send your bank details to receive the cash.'),
	spam('Confirm your card details to avoid suspension of your subscription.'),
	spam('Exclusive offer: free gift card, claim within 24 hours.'),
	spam('Miracle pill melts fat overnight. Order now at a cheap price.'),
	spam('Urgent: the director needs you to buy gift cards and send the codes.'),
	spam('Your mailbox storage is full. Re-enter your login to keep receiving mail.'),
	spam('Risk free investment returns. Join now, limited spots.'),
	ham('Are you free for a call tomorrow afternoon about the project plan?'),
	ham('The meeting notes are attached. Thanks everyone for joining.'),
	ham('Your order has been delivered. Rate your purchase.'),
	ham('Big summer sale: 20% off outdoor gear this weekend.'),
	ham('Dinner on Friday? I booked a table for four at 8.'),
	ham('Your appointment is confirmed for Monday at 10am.'),
	ham('Weekly forum digest: new topics about trail running shoes.'),
	ham('Please review the pull request when you have a moment.'),
	ham('The kids loved the museum. Photos are in the album.'),
	ham('Here is the invoice for last month. Let me know if you have questions.'),
	ham('Reminder: team standup moves to 9:45 starting next week.'),
	ham('Your statement for September is available in online banking.')
];
