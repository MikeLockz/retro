// List of fun animal names for anonymous users
export const animals = [
    'Aardvark', 'Alpaca', 'Badger', 'Bear', 'Beaver',
    'Buffalo', 'Capybara', 'Cat', 'Chameleon', 'Cheetah',
    'Chinchilla', 'Chipmunk', 'Coyote', 'Crane', 'Deer',
    'Dolphin', 'Duck', 'Eagle', 'Elephant', 'Falcon',
    'Ferret', 'Flamingo', 'Fox', 'Frog', 'Gazelle',
    'Giraffe', 'Gorilla', 'Hamster', 'Hawk', 'Hedgehog',
    'Hippo', 'Hummingbird', 'Hyena', 'Iguana', 'Jaguar',
    'Kangaroo', 'Koala', 'Lemur', 'Leopard', 'Lion',
    'Llama', 'Lynx', 'Meerkat', 'Mongoose', 'Monkey',
    'Moose', 'Narwhal', 'Octopus', 'Otter', 'Owl',
    'Panda', 'Panther', 'Parrot', 'Peacock', 'Pelican',
    'Penguin', 'Phoenix', 'Porcupine', 'Puma', 'Quail',
    'Rabbit', 'Raccoon', 'Raven', 'Rhino', 'Salamander',
    'Seal', 'Shark', 'Sloth', 'Snake', 'Sparrow',
    'Squirrel', 'Swan', 'Tiger', 'Toucan', 'Turtle',
    'Unicorn', 'Walrus', 'Whale', 'Wolf', 'Wolverine',
    'Wombat', 'Yak', 'Zebra'
]

export function getRandomAnimal() {
    return animals[Math.floor(Math.random() * animals.length)]
}
