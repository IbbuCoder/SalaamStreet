using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using SalaamStreet.Desktop.Models;

namespace SalaamStreet.Desktop.Views;

public partial class LearnView : UserControl
{
    // A small starter deck of common Qur'anic words. Expanded in a later session
    // and gated (free = starter deck, premium = full decks).
    private static readonly Flashcard[] Deck =
    {
        new("اللَّه", "Allah — God", "The proper name of God."),
        new("رَبّ", "Rabb — Lord, Sustainer", "As in Rabb al-'alamin."),
        new("رَحْمَة", "Rahmah — mercy", "Root r-h-m."),
        new("كِتَاب", "Kitab — book, scripture", ""),
        new("عِلْم", "'Ilm — knowledge", ""),
        new("صَبْر", "Sabr — patience", ""),
        new("شُكْر", "Shukr — gratitude", ""),
        new("نُور", "Nur — light", ""),
        new("قَلْب", "Qalb — heart", ""),
        new("سَلَام", "Salam — peace", "The root of 'Islam' and 'SalaamStreet'."),
    };

    private int _index;
    private bool _flipped;

    public LearnView()
    {
        InitializeComponent();
        Loaded += (_, _) => { Focusable = true; Keyboard.Focus(this); Render(); };
        KeyDown += OnKeyDown;
    }

    private void Render()
    {
        var c = Deck[_index];
        CardFront.Text = c.Front;
        CardBack.Text = c.Back;
        CardNote.Text = c.Note;
        CardBack.Visibility = _flipped ? Visibility.Visible : Visibility.Collapsed;
        CardNote.Visibility = (_flipped && !string.IsNullOrEmpty(c.Note)) ? Visibility.Visible : Visibility.Collapsed;
        Progress.Text = $"Card {_index + 1} of {Deck.Length}";
    }

    private void Flip() { _flipped = !_flipped; Render(); }
    private void Next() { _index = (_index + 1) % Deck.Length; _flipped = false; Render(); }
    private void Prev() { _index = (_index - 1 + Deck.Length) % Deck.Length; _flipped = false; Render(); }

    private void Card_Click(object sender, MouseButtonEventArgs e) => Flip();
    private void Next_Click(object sender, RoutedEventArgs e) => Next();
    private void Prev_Click(object sender, RoutedEventArgs e) => Prev();

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        switch (e.Key)
        {
            case Key.Space: Flip(); e.Handled = true; break;
            case Key.Right: Next(); e.Handled = true; break;
            case Key.Left: Prev(); e.Handled = true; break;
        }
    }
}
