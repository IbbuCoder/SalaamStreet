using System.Windows;

namespace SalaamStreet.Desktop;

public partial class LoginWindow : Window
{
    private bool _signUpMode;

    public LoginWindow()
    {
        InitializeComponent();
        ConfigNote.Visibility = App.Account.Configured ? Visibility.Collapsed : Visibility.Visible;
        UpdateMode();
    }

    private void UpdateMode()
    {
        Subtitle.Text = _signUpMode
            ? "Create an account to sync across the website and this app."
            : "Sign in to sync your bookmarks, progress and premium status.";
        PrimaryBtn.Content = _signUpMode ? "Create account" : "Sign in";
        SecondaryBtn.Content = _signUpMode ? "I already have an account" : "Create an account instead";
    }

    private void Toggle_Click(object sender, RoutedEventArgs e)
    {
        _signUpMode = !_signUpMode;
        Status.Text = "";
        UpdateMode();
    }

    private async void Primary_Click(object sender, RoutedEventArgs e)
    {
        var email = EmailBox.Text.Trim();
        var pw = PasswordBox.Password;
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(pw))
        {
            Status.Text = "Please enter your email and password.";
            return;
        }

        PrimaryBtn.IsEnabled = false;
        Status.Text = "Please wait…";
        var (ok, message) = _signUpMode
            ? await App.Account.SignUpAsync(email, pw)
            : await App.Account.SignInAsync(email, pw);
        PrimaryBtn.IsEnabled = true;
        Status.Text = message;

        if (ok && App.Account.IsSignedIn)
        {
            await App.Account.RefreshProfileAsync();
            DialogResult = true;
            Close();
        }
    }
}
